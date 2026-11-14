import { requireContext } from "@/server/context";
import { db } from "@/lib/db";

// Phase 1 placeholder: real, tenant-scoped counts. Charts and KPIs arrive with sales/accounting (Phase 8).
export default async function Dashboard() {
  const ctx = await requireContext("dashboard.view");
  const where = { businessId: ctx.businessId };
  const [products, customers, branches] = await Promise.all([
    db.product.count({ where }), db.customer.count({ where }), db.branch.count({ where }),
  ]);
  const stats = [["Products", products], ["Customers", customers], ["Branches", branches]];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {ctx.userName.split(" ")[0]}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">{l}</p><p className="num mt-1 text-3xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <p className="max-w-prose text-sm text-muted">Add your first products in Inventory to start selling. Sales, stock and finances will appear here as you work.</p>
    </div>
  );
}
