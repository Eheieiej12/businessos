import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireContext } from "@/server/context";
import { updateProductAction } from "@/server/inventory-actions";

const inputClass = "mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink";
const labelClass = "block text-sm font-medium text-muted";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext("inventory.manage");
  const { id } = await params;
  const [product, categories] = await Promise.all([
    db.product.findFirst({ where: { id, businessId: ctx.businessId } }),
    db.category.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><Link href="/inventory" className="text-sm font-medium text-brand">← Back to inventory</Link><h1 className="mt-3 text-2xl font-semibold tracking-tight">Edit product</h1><p className="mt-1 text-sm text-muted">Update product details for {product.name}.</p></div>
      <form action={updateProductAction} className="space-y-4 rounded-xl border border-line bg-surface p-5">
        <input type="hidden" name="productId" value={product.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Product name<input name="name" required minLength={2} maxLength={120} defaultValue={product.name} className={inputClass} /></label>
          <label className={labelClass}>SKU<input name="sku" required maxLength={64} defaultValue={product.sku} className={inputClass} /></label>
          <label className={labelClass}>Barcode<input name="barcode" maxLength={128} defaultValue={product.barcode ?? ""} className={inputClass} /></label>
          <label className={labelClass}>Category<select name="categoryId" defaultValue={product.categoryId ?? ""} className={inputClass}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={labelClass}>Cost price<input name="costPrice" type="number" min="0" step="0.01" required defaultValue={Number(product.costPrice)} className={inputClass} /></label>
          <label className={labelClass}>Sale price<input name="salePrice" type="number" min="0" step="0.01" required defaultValue={Number(product.salePrice)} className={inputClass} /></label>
          <label className={labelClass}>Currency<select name="currency" defaultValue={product.currency} className={inputClass}><option value="USD">USD</option><option value="SOS">SOS</option></select></label>
          <label className={labelClass}>Unit<input name="unit" required maxLength={24} defaultValue={product.unit} className={inputClass} /></label>
          <label className={labelClass}>Low-stock threshold<input name="reorderLevel" type="number" min="0" required defaultValue={product.reorderLevel} className={inputClass} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="trackStock" defaultChecked={product.trackStock} className="size-4 accent-brand" /> Track stock</label>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4"><Link href="/inventory" className="rounded-lg border border-line px-4 py-2.5 text-sm">Cancel</Link><button className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink">Save changes</button></div>
      </form>
    </div>
  );
}
