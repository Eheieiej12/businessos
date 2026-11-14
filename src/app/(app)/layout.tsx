import { requireContext } from "@/server/context";
import { can } from "@/lib/permissions";
import { NAV } from "@/components/layout/nav";
import { Shell } from "@/components/layout/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext(); // redirects to /login when unauthenticated
  const items = NAV.filter((n) => can(ctx.role, n.perm)).map(({ href, label }) => ({ href, label }));
  return <Shell items={items} business={ctx.business.name} user={ctx.userName}>{children}</Shell>;
}
