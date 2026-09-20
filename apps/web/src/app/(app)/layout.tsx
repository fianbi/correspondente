import { requireOrgContext, requireSessionUser } from "@/server/session";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { UserMenu } from "@/components/shell/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  const org = await requireOrgContext();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <OrgSwitcher memberships={org.memberships} activeOrgId={org.orgId} />
        <SidebarNav />
        <UserMenu user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
