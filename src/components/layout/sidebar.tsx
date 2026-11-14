"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, LogOut, Menu, X, Command, ChevronDown, PanelLeftClose, Sparkles } from "lucide-react";
import { useState } from "react";
import { NAV } from "./nav";
import { logoutAction } from "@/server/auth-actions";

type Item = { href: string; label: string };
const groups = [
  { label: "WORKSPACE", links: ["/dashboard", "/pos", "/sales", "/inventory", "/purchases"] },
  { label: "RELATIONSHIPS", links: ["/customers", "/suppliers", "/hr"] },
  { label: "FINANCE", links: ["/expenses", "/accounting", "/reports"] },
  { label: "ADMINISTRATION", links: ["/users", "/audit", "/settings"] },
];

export function Shell({ items, business, user, children }: {
  items: Item[]; business: string; user: string; children: React.ReactNode;
}) {
  const path = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const icons = Object.fromEntries(NAV.map((n) => [n.href, n.icon]));

  const nav = (
    <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-3">
      {groups.map((group) => {
        const links = group.links.map((href) => items.find((item) => item.href === href)).filter((item): item is Item => Boolean(item));
        if (!links.length) return null;
        return <div key={group.label}>
          {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold tracking-[.16em] text-muted/75">{group.label}</p>}
          <div className="space-y-1">{links.map((item) => {
            const Icon = icons[item.href];
            const active = path === item.href || path.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${active ? "bg-brand-soft text-brand shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"} `}>
              <Icon size={18} strokeWidth={active ? 2.3 : 1.8} className="shrink-0" />{!collapsed && <span className="truncate">{item.label}</span>}
              {active && !collapsed && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
            </Link>;
          })}</div>
        </div>;
      })}
    </nav>
  );

  const side = (
    <div className="flex h-full flex-col">
      <div className={`flex h-[76px] items-center border-b border-line px-5 ${collapsed ? "justify-center" : "gap-3"}`}>
        <div className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-violet-500 text-white shadow-lg shadow-brand/25"><Command size={20}/><span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-surface bg-emerald-400"/></div>
        {!collapsed && <div className="min-w-0"><p className="text-[15px] font-extrabold tracking-tight">Business<span className="text-brand">OS</span></p><p className="flex items-center gap-1 text-[10px] font-semibold tracking-[.12em] text-muted"><Sparkles size={10}/> BUSINESS SUITE</p></div>}
      </div>
      <div className={`mx-3 mt-4 rounded-xl border border-line bg-surface-2/70 p-3 ${collapsed ? "hidden" : ""}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Current workspace</p>
        <div className="mt-2 flex items-center gap-2"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-xs font-bold text-brand">{business.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{business}</p><p className="text-[10px] text-muted">Business account</p></div><ChevronDown size={14} className="text-muted"/></div>
      </div>
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        {!collapsed && <span className="text-[10px] font-bold uppercase tracking-[.16em] text-muted">Navigation</span>}
        <button onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar" className="hidden rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:grid"><PanelLeftClose size={15}/></button>
      </div>
      {nav}
      <div className="border-t border-line p-3">
        <div className={`mb-2 flex items-center gap-2 rounded-xl p-2 ${collapsed ? "justify-center" : "bg-surface-2/70"}`}>
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-violet-500 text-[11px] font-bold text-white">{user.slice(0,1).toUpperCase()}</div>
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{user}</p><p className="text-[10px] text-muted">Workspace member</p></div>}
        </div>
        <div className={`flex ${collapsed ? "flex-col" : ""} gap-1`}>
          <button aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-surface-2"><Moon size={15} className="block dark:hidden"/><Sun size={15} className="hidden dark:block"/> {!collapsed && "Toggle theme"}</button>
          <form action={logoutAction} className="flex-1"><button aria-label="Sign out" className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted hover:bg-danger/10 hover:text-danger"><LogOut size={15}/>{!collapsed && "Sign out"}</button></form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg lg:grid" style={{ gridTemplateColumns: collapsed ? "84px minmax(0,1fr)" : "268px minmax(0,1fr)" }}>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{side}</aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-line bg-surface/80 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-xl border border-line p-2 text-muted lg:hidden"><Menu size={18}/></button>
            <div className="min-w-0"><p className="truncate text-[11px] font-medium text-muted">YOUR WORKSPACE</p><p className="truncate text-sm font-semibold tracking-tight">{NAV.find(n => path === n.href || path.startsWith(n.href + "/"))?.label ?? "Overview"}</p></div>
          </div>
          <div className="flex items-center gap-2"><button aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="rounded-xl border border-line bg-surface p-2.5 text-muted shadow-sm transition hover:bg-surface-2 hover:text-ink"><Moon size={16} className="block dark:hidden"/><Sun size={16} className="hidden dark:block"/></button><div className="hidden size-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-xs font-bold text-white shadow-sm sm:grid">{user.slice(0,1).toUpperCase()}</div></div>
        </header>
        <main className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-9">{children}</main>
      </div>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setOpen(false)}/><div className="relative h-full w-[290px] bg-surface shadow-2xl"><button aria-label="Close" className="absolute right-3 top-5 z-10 rounded-lg p-2 text-muted hover:bg-surface-2" onClick={() => setOpen(false)}><X size={18}/></button>{side}</div></div>}
    </div>
  );
}
