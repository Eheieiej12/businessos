import { Suspense } from "react";
import { requireContext } from "@/server/context";
import { db } from "@/lib/db";

export default function CustomersPage() { return <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}><Content /></Suspense>; }
async function Content() {
  const ctx = await requireContext("customers.manage");
  const rows = await db.customer.findMany({ where: { businessId: ctx.businessId }, orderBy: { name: "asc" }, take: 200 });
  return <section className="space-y-5"><header><h1 className="text-2xl font-semibold">Customers</h1><p className="text-sm text-muted">Customer directory · {rows.length} shown</p></header><div className="overflow-x-auto rounded-xl border border-line bg-surface"><table className="w-full text-left text-sm"><thead className="bg-surface-2 text-muted"><tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Address</th><th className="p-3">Credit limit</th><th className="p-3">Added</th></tr></thead><tbody className="divide-y divide-line">{rows.map(x=><tr key={x.id}><td className="p-3 font-medium">{x.name}</td><td className="p-3">{x.phone || "—"}</td><td className="p-3">{x.address || "—"}</td><td className="p-3">{Number(x.creditLimit).toFixed(2)}</td><td className="p-3">{x.createdAt.toLocaleDateString()}</td></tr>)}{!rows.length&&<tr><td colSpan={5} className="p-8 text-center text-muted">No customers yet. Customers added during POS sales appear here.</td></tr>}</tbody></table></div></section>;
}