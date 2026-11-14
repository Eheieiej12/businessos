"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, StockMoveType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { audit } from "@/server/audit";

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(128).optional(),
  categoryId: z.string().trim().optional(),
  unit: z.string().trim().min(1).max(24),
  costPrice: z.coerce.number().finite().min(0).max(999999999),
  salePrice: z.coerce.number().finite().min(0).max(999999999),
  currency: z.enum(["USD", "SOS"]),
  reorderLevel: z.coerce.number().int().min(0).max(100000000),
  trackStock: z.enum(["on", "off"]).optional(),
});

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectError(message: string): never {
  redirect(`/inventory?error=${encodeURIComponent(message)}`);
}

function isRedirect(error: unknown) {
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

async function validateCategory(categoryId: string | undefined, businessId: string) {
  if (!categoryId) return null;
  const category = await db.category.findFirst({ where: { id: categoryId, businessId } });
  if (!category) throw new Error("Selected category was not found.");
  return category.id;
}

async function validateBarcode(barcode: string | undefined, businessId: string, exceptProductId?: string) {
  if (!barcode) return;
  const existing = await db.product.findFirst({
    where: { businessId, barcode, ...(exceptProductId ? { id: { not: exceptProductId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new Error("This barcode is already used by another product.");
}

export async function createProductAction(formData: FormData) {
  const ctx = await requireContext("inventory.manage");
  const parsed = productSchema.safeParse(formObject(formData));
  if (!parsed.success) redirectError(parsed.error.issues[0]?.message ?? "Check the product details.");
  const data = parsed.data;
  try {
    const categoryId = await validateCategory(data.categoryId, ctx.businessId);
    await validateBarcode(data.barcode || undefined, ctx.businessId);
    await db.product.create({
      data: {
        businessId: ctx.businessId,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || null,
        categoryId,
        unit: data.unit,
        costPrice: new Prisma.Decimal(data.costPrice),
        salePrice: new Prisma.Decimal(data.salePrice),
        currency: data.currency,
        reorderLevel: data.reorderLevel,
        trackStock: data.trackStock === "on",
      },
    });
    await audit(ctx, "inventory.product.create", "Product", undefined, {
      sku: data.sku, name: data.name,
    });
    revalidatePath("/inventory");
    redirect("/inventory?success=product-created");
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectError("That SKU is already used in this business.");
    }
    redirectError(error instanceof Error ? error.message : "Unable to create product.");
  }
}

export async function updateProductAction(formData: FormData) {
  const ctx = await requireContext("inventory.manage");
  const productId = String(formData.get("productId") ?? "");
  const parsed = productSchema.safeParse(formObject(formData));
  if (!productId || !parsed.success) redirectError("Check the product details and try again.");
  const data = parsed.data;
  try {
    const existing = await db.product.findFirst({
      where: { id: productId, businessId: ctx.businessId },
      select: { id: true, sku: true, name: true },
    });
    if (!existing) redirectError("Product not found.");
    const categoryId = await validateCategory(data.categoryId, ctx.businessId);
    await validateBarcode(data.barcode || undefined, ctx.businessId, productId);
    await db.product.update({
      where: { id: productId, businessId: ctx.businessId },
      data: {
        name: data.name, sku: data.sku, barcode: data.barcode || null,
        categoryId, unit: data.unit,
        costPrice: new Prisma.Decimal(data.costPrice),
        salePrice: new Prisma.Decimal(data.salePrice),
        currency: data.currency, reorderLevel: data.reorderLevel,
        trackStock: data.trackStock === "on",
      },
    });
    await audit(ctx, "inventory.product.update", "Product", productId, {
      previousSku: existing.sku, sku: data.sku,
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${productId}/edit`);
    redirect("/inventory?success=product-updated");
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectError("That SKU is already used in this business.");
    }
    redirectError(error instanceof Error ? error.message : "Unable to update product.");
  }
}

export async function createCategoryAction(formData: FormData) {
  const ctx = await requireContext("inventory.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 64) redirectError("Category name must be 2–64 characters.");
  try {
    const category = await db.category.create({ data: { businessId: ctx.businessId, name } });
    await audit(ctx, "inventory.category.create", "Category", category.id, { name });
    revalidatePath("/inventory");
    redirect("/inventory?success=category-created");
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirectError("That category already exists.");
    }
    redirectError("Unable to create category.");
  }
}

const stockSchema = z.object({
  productId: z.string().min(1),
  branchId: z.string().min(1),
  movement: z.enum(["in", "out", "adjustment"]),
  quantity: z.coerce.number().int().positive().max(100000000),
  unitCost: z.coerce.number().finite().min(0).max(999999999).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function recordStockMovementAction(formData: FormData) {
  const ctx = await requireContext("inventory.manage");
  const parsed = stockSchema.safeParse(formObject(formData));
  if (!parsed.success) redirectError(parsed.error.issues[0]?.message ?? "Check the stock movement details.");
  const data = parsed.data;
  try {
    const branch = await db.branch.findFirst({
      where: {
        id: data.branchId,
        businessId: ctx.businessId,
        active: true,
        ...(ctx.branchId ? { id: ctx.branchId } : {}),
      },
      select: { id: true },
    });
    if (!branch) throw new Error("Selected branch is unavailable for your account.");
    const product = await db.product.findFirst({
      where: { id: data.productId, businessId: ctx.businessId, active: true },
      select: { id: true, name: true, trackStock: true, costPrice: true },
    });
    if (!product) throw new Error("Selected product was not found.");
    if (!product.trackStock) throw new Error("Stock tracking is disabled for this product.");

    const signedQuantity = data.movement === "out" ? -data.quantity : data.quantity;
    const type: StockMoveType = data.movement === "in" ? "PURCHASE" : "ADJUSTMENT";
    await db.$transaction(async (tx) => {
      const current = await tx.stockMovement.aggregate({
        where: { businessId: ctx.businessId, branchId: branch.id, productId: product.id },
        _sum: { quantity: true },
      });
      const onHand = current._sum.quantity ?? 0;
      if (onHand + signedQuantity < 0) {
        throw new Error(`Insufficient stock. Current balance: ${onHand} ${product.name}.`);
      }
      const movement = await tx.stockMovement.create({
        data: {
          businessId: ctx.businessId,
          branchId: branch.id,
          productId: product.id,
          type,
          quantity: signedQuantity,
          unitCost: data.unitCost === undefined ? product.costPrice : new Prisma.Decimal(data.unitCost),
          note: data.note || (data.movement === "in" ? "Stock received" : data.movement === "out" ? "Stock issued" : "Stock adjustment"),
          refType: "InventoryAdjustment",
          createdById: ctx.userId,
        },
      });
      await audit(ctx, "inventory.stock.movement", "StockMovement", movement.id, {
        productId: product.id, branchId: branch.id, type, quantity: signedQuantity,
      }, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath("/inventory");
    revalidatePath("/pos");
    redirect("/inventory?success=stock-updated");
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirectError(error instanceof Error ? error.message : "Unable to record stock movement.");
  }
}
