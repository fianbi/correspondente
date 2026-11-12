import { requireOrgContext, requireSessionUser } from "@/server/session";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { QuickSearch } from "@/components/shell/quick-search";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSessionUser();
  const org = await requireOrgContext();

  const menu = (
    <>
      <OrgSwitcher memberships={org.memberships} activeOrgId={org.orgId} />
      <QuickSearch />
      <SidebarNav />
      <UserMenu user={user} />
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <MobileMenu title={org.orgName}>{menu}</MobileMenu>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        {menu}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
