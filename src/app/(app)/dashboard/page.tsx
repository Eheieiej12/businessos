import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, Boxes, ShoppingBag, Users, Wallet, Activity, Plus, ChevronRight } from "lucide-react";
import { requireContext } from "@/server/context";
import { db } from "@/lib/db";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
function DashboardFallback() {
  return <div className="space-y-6" aria-busy="true"><div className="h-28 animate-pulse rounded-3xl bg-surface-2"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(x=><div key={x} className="h-32 animate-pulse rounded-2xl bg-surface-2"/>)}</div><div className="h-72 animate-pulse rounded-2xl bg-surface-2"/></div>;
}
export default function Dashboard() {
  return <Suspense fallback={<DashboardFallback/>}><DashboardContent/></Suspense>;
}
async function DashboardContent() {
  const ctx = await requireContext("dashboard.view");
  const scope = { businessId: ctx.businessId, ...(ctx.branchId ? { branchId: ctx.branchId } : {}) };
  const since = new Date(); since.setDate(since.getDate()-30);
  const [business,products,customers,branches,sales,recentSales,expenses,lowStock] = await Promise.all([
    db.business.findUniqueOrThrow({where:{id:ctx.businessId},select:{baseCurrency:true}}),
    db.product.count({where:{businessId:ctx.businessId,active:true}}),
    db.customer.count({where:{businessId:ctx.businessId}}),
    db.branch.count({where:{businessId:ctx.businessId,active:true}}),
    db.sale.aggregate({where:{...scope,status:"COMPLETED",createdAt:{gte:since}},_sum:{total:true,paid:true},_count:true}),
    db.sale.findMany({where:scope,include:{customer:{select:{name:true}},branch:{select:{name:true}}},orderBy:{createdAt:"desc"},take:6}),
    db.expense.aggregate({where:{businessId:ctx.businessId,...(ctx.branchId?{branchId:ctx.branchId}:{}),incurredAt:{gte:since}},_sum:{amount:true}}),
    db.product.findMany({where:{businessId:ctx.businessId,active:true,trackStock:true},select:{id:true,name:true,reorderLevel:true,unit:true},take:250})
  ]);
  const movements = await db.stockMovement.groupBy({by:["productId"],where:{businessId:ctx.businessId,...(ctx.branchId?{branchId:ctx.branchId}:{})},_sum:{quantity:true}});
  const stockMap = new Map(movements.map(m=>[m.productId,m._sum.quantity??0]));
  const low = lowStock.map(p=>({...p,qty:stockMap.get(p.id)??0})).filter(p=>p.qty<=p.reorderLevel).sort((a,b)=>a.qty-b.qty).slice(0,5);
  const cards = [
    {label:"Sales revenue · 30 days",value:money(Number(sales._sum.total??0),business.baseCurrency),hint:`${sales._count} completed transactions`,icon:ShoppingBag,accent:"bg-indigo-500/10 text-indigo-500"},
    {label:"Payments collected",value:money(Number(sales._sum.paid??0),business.baseCurrency),hint:"Received from customers",icon:Wallet,accent:"bg-emerald-500/10 text-emerald-500"},
    {label:"Active products",value:String(products),hint:`${low.length} products need restocking`,icon:Boxes,accent:"bg-amber-500/10 text-amber-600"},
    {label:"Customers",value:String(customers),hint:`${branches} active branches`,icon:Users,accent:"bg-violet-500/10 text-violet-500"},
  ];
  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#25245f] via-[#4338ca] to-[#6366f1] p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border-[36px] border-white/5"/><div className="pointer-events-none absolute -bottom-36 right-1/4 size-72 rounded-full bg-white/5 blur-2xl"/>
      <div className="relative flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-100">Business overview</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Good to see you, {ctx.userName.split(" ")[0]}.</h1><p className="mt-2 max-w-xl text-sm text-indigo-100">Here’s what’s happening across your business over the last 30 days.</p></div><div className="flex flex-wrap gap-2"><Link href="/pos" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"><Plus size={16}/> New sale</Link><Link href="/inventory" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">Manage inventory <ArrowUpRight size={15}/></Link></div></div>
      <div className="relative mt-8 flex items-center gap-2 text-xs text-indigo-100"><Activity size={14}/> Live business snapshot <span className="size-1 rounded-full bg-emerald-300"/> Updated on page load</div>
    </section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card=><article key={card.label} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted">{card.label}</p><span className={`grid size-10 place-items-center rounded-xl ${card.accent}`}><card.icon size={19}/></span></div><p className="num mt-4 text-2xl font-bold tracking-tight">{card.value}</p><p className="mt-1 text-xs text-muted">{card.hint}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.8fr)]">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Recent transactions</h2><p className="mt-1 text-xs text-muted">Latest activity from your sales counter</p></div><Link href="/sales" className="inline-flex items-center gap-1 text-xs font-semibold text-brand">View all <ChevronRight size={14}/></Link></div>
      {recentSales.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-surface-2/70 text-[10px] font-semibold uppercase tracking-wider text-muted"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-line">{recentSales.map(s=><tr key={s.id}><td className="whitespace-nowrap px-5 py-3 font-semibold">{s.number}</td><td className="px-5 py-3">{s.customer?.name??"Walk-in"}</td><td className="px-5 py-3 text-muted">{s.branch.name}</td><td className="whitespace-nowrap px-5 py-3 font-semibold num">{money(Number(s.total),business.baseCurrency)}</td><td className="px-5 py-3"><span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">{s.paymentStatus}</span></td></tr>)}</tbody></table></div>:<div className="p-10 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted"><ShoppingBag size={20}/></div><p className="mt-3 text-sm font-semibold">No transactions yet</p><p className="mt-1 text-xs text-muted">Your completed sales will appear here.</p><Link href="/pos" className="mt-4 inline-flex text-xs font-semibold text-brand">Open point of sale <ArrowUpRight size={13}/></Link></div>}</div>
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Stock watch</h2><p className="mt-1 text-xs text-muted">Products at or below reorder level</p></div><span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600">{low.length} alerts</span></div>{low.length?<div className="mt-4 space-y-4">{low.map(p=><div key={p.id}><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium">{p.name}</p><span className="shrink-0 text-xs font-semibold text-amber-600">{p.qty} {p.unit}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-amber-500" style={{width:`${Math.max(4,Math.min(100,p.reorderLevel? p.qty/p.reorderLevel*100:4))}%`}}/></div><p className="mt-1 text-[10px] text-muted">Reorder level: {p.reorderLevel}</p></div>)}</div>:<div className="py-10 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-success/10 text-success"><Boxes size={20}/></div><p className="mt-3 text-sm font-semibold">Stock levels look good</p><p className="mt-1 text-xs text-muted">No low-stock alerts right now.</p></div>}<Link href="/inventory" className="mt-5 flex items-center justify-center gap-1 rounded-xl border border-line px-3 py-2.5 text-xs font-semibold hover:bg-surface-2">Open inventory <ChevronRight size={14}/></Link></div>
    </section>
    <p className="text-center text-[11px] text-muted">Expenses in last 30 days: {money(Number(expenses._sum.amount??0),business.baseCurrency)} · {branches} active branch{branches===1?"":"es"}</p>
  </div>;
}
