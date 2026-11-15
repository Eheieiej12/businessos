import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { can } from "@/lib/permissions";
import { createCategoryAction, createProductAction, recordStockMovementAction } from "@/server/inventory-actions";

type SearchParams = Promise<{ q?: string; error?: string; success?: string }>;

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

const fieldClass = "mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink";
const labelClass = "block text-xs font-medium text-muted";

export default function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-line bg-surface" />}>
      <InventoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InventoryContent({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext("inventory.view");
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const branchWhere = ctx.branchId
    ? { id: ctx.branchId, businessId: ctx.businessId, active: true }
    : { businessId: ctx.businessId, active: true };

  const [business, products, categories, branches, stockRows] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: ctx.businessId }, select: { baseCurrency: true } }),
    db.product.findMany({
      where: {
        businessId: ctx.businessId,
        ...(query ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { barcode: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 200,
    }),
    db.category.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" } }),
    db.branch.findMany({ where: branchWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.stockMovement.groupBy({
      by: ["productId", "branchId"],
      where: {
        businessId: ctx.businessId,
        ...(ctx.branchId ? { branchId: ctx.branchId } : {}),
      },
      _sum: { quantity: true },
    }),
  ]);

  const balanceByProduct = new Map<string, number>();
  const balanceByProductBranch = new Map<string, number>();
  for (const row of stockRows) {
    const quantity = row._sum.quantity ?? 0;
    balanceByProduct.set(row.productId, (balanceByProduct.get(row.productId) ?? 0) + quantity);
    balanceByProductBranch.set(`${row.productId}:${row.branchId}`, quantity);
  }
  const lowStockProductIds = new Set<string>();
  for (const product of products) {
    if (!product.active || !product.trackStock) continue;
    for (const branch of branches) {
      const quantity = balanceByProductBranch.get(`${product.id}:${branch.id}`) ?? 0;
      if (quantity <= product.reorderLevel) {
        lowStockProductIds.add(product.id);
        break;
      }
    }
  }
  const lowStock = lowStockProductIds.size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Inventory</h1><p className="mt-1 text-sm text-muted">Products, categories and branch stock balances.</p></div>
        <div className="flex gap-2 text-sm"><span className="rounded-lg bg-surface-2 px-3 py-2">{products.length} products</span><span className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">{lowStock} low stock</span></div>
      </div>

      {params.error && <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">{params.error}</p>}
      {params.success && <p role="status" className="rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
        {params.success === "product-created" ? "Product created." : params.success === "product-updated" ? "Product updated." : params.success === "category-created" ? "Category created." : "Stock balance updated."}
      </p>}

      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={query} placeholder="Search name, SKU or barcode..." className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        <button className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium">Search</button>
        {query && <Link href="/inventory" className="rounded-lg border border-line px-4 py-2 text-sm text-muted">Clear</Link>}
      </form>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-semibold">Products</h2><span className="text-xs text-muted">Showing up to 200</span></div>
            {products.length === 0 ? (
              <div className="p-10 text-center"><p className="font-medium">No products found</p><p className="mt-1 text-sm text-muted">Add a product or change your search.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {products.map((product) => {
                      const quantity = balanceByProduct.get(product.id) ?? 0;
                      const isLow = product.active && product.trackStock && lowStockProductIds.has(product.id);
                      return (
                        <tr key={product.id}>
                          <td className="min-w-52 px-4 py-3"><p className="font-medium">{product.name}</p><p className="mt-0.5 text-xs text-muted">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</p></td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted">{product.category?.name ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 num">{money(Number(product.costPrice), product.currency)}</td>
                          <td className="whitespace-nowrap px-4 py-3 num">{money(Number(product.salePrice), product.currency)}</td>
                          <td className="whitespace-nowrap px-4 py-3 num">{product.trackStock ? `${quantity} ${product.unit}` : "Not tracked"}</td>
                          <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${!product.active ? "bg-surface-2 text-muted" : isLow ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-success/10 text-success"}`}>{!product.active ? "Archived" : isLow ? "Low stock" : "In stock"}</span></td>
                          <td className="whitespace-nowrap px-4 py-3"><Link href={`/inventory/${product.id}/edit`} className="font-medium text-brand">Edit</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3"><h2 className="font-semibold">Branch stock balances</h2></div>
            {branches.length === 0 ? <p className="p-5 text-sm text-muted">No active branches available.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">On hand</th><th className="px-4 py-3">Reorder at</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {products.filter((p) => p.trackStock).flatMap((product) => branches.map((branch) => {
                      const quantity = balanceByProductBranch.get(`${product.id}:${branch.id}`) ?? 0;
                      return <tr key={`${product.id}:${branch.id}`}><td className="px-4 py-3 font-medium">{product.name}</td><td className="px-4 py-3 text-muted">{branch.name}</td><td className={`px-4 py-3 num ${quantity <= product.reorderLevel ? "text-amber-700 dark:text-amber-300" : ""}`}>{quantity} {product.unit}{quantity <= product.reorderLevel && <span className="ml-2 text-xs">Low</span>}</td><td className="px-4 py-3 num">{product.reorderLevel}</td></tr>;
                    }))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          {can(ctx.role, "inventory.manage") && (
            <>
              <form action={createProductAction} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <h2 className="font-semibold">Add product</h2>
                <label className={labelClass}>Product name<input name="name" required minLength={2} maxLength={120} className={fieldClass} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>SKU<input name="sku" required maxLength={64} className={fieldClass} /></label>
                  <label className={labelClass}>Barcode<input name="barcode" maxLength={128} className={fieldClass} /></label>
                </div>
                <label className={labelClass}>Category<select name="categoryId" className={fieldClass}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>Cost price<input name="costPrice" type="number" min="0" step="0.01" required className={fieldClass} /></label>
                  <label className={labelClass}>Sale price<input name="salePrice" type="number" min="0" step="0.01" required className={fieldClass} /></label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>Currency<select name="currency" defaultValue={business.baseCurrency} className={fieldClass}><option value="USD">USD</option><option value="SOS">SOS</option></select></label>
                  <label className={labelClass}>Unit<input name="unit" defaultValue="pcs" required maxLength={24} className={fieldClass} /></label>
                </div>
                <label className={labelClass}>Low-stock threshold<input name="reorderLevel" type="number" min="0" defaultValue="5" required className={fieldClass} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="trackStock" defaultChecked className="size-4 accent-brand" /> Track stock</label>
                <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">Create product</button>
              </form>

              <form action={createCategoryAction} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <h2 className="font-semibold">Add category</h2>
                <label className={labelClass}>Category name<input name="name" required minLength={2} maxLength={64} className={fieldClass} /></label>
                <button className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-semibold">Create category</button>
                <p className="text-xs text-muted">{categories.length} categories</p>
              </form>

              <form action={recordStockMovementAction} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                <h2 className="font-semibold">Stock movement</h2>
                <label className={labelClass}>Product<select name="productId" required className={fieldClass}><option value="">Select product</option>{products.filter((p) => p.active && p.trackStock).map((product) => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label>
                <label className={labelClass}>Branch<select name="branchId" required className={fieldClass}><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
                <label className={labelClass}>Movement<select name="movement" defaultValue="in" className={fieldClass}><option value="in">Stock in</option><option value="out">Stock out</option><option value="adjustment-in">Adjustment (increase)</option><option value="adjustment-out">Adjustment (decrease)</option></select></label>
                <label className={labelClass}>Quantity<input name="quantity" type="number" min="1" step="1" required className={fieldClass} /></label>
                <label className={labelClass}>Unit cost (optional)<input name="unitCost" type="number" min="0" step="0.01" className={fieldClass} /></label>
                <label className={labelClass}>Note<input name="note" maxLength={500} className={fieldClass} /></label>
                <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink">Save stock movement</button>
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
