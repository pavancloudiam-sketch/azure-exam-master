import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppLayout } from "./AppLayout";
import type { NavGroup } from "./AppSidebar";
import { PublicHeader } from "./PublicHeader";
import { SiteFooter } from "./SiteFooter";
import {
  adminNav,
  adminUtilityNav,
  organizationNav,
  studentNav,
  studentUtilityNav,
} from "./ui/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useOrgAccess } from "@/features/organizations/hooks/use-org-access";

/** Paths that always render inside the authenticated application shell. */
const APP_PREFIXES = [
  "/dashboard",
  "/exams",
  "/attempts",
  "/study",
  "/interview",
  "/resources",
  "/billing",
  "/profile",
  "/help",
  "/privacy",
  "/organization",
  "/results",
  "/review",
  "/admin",
  "/internal",
];

/** Active exam sessions get a dedicated distraction-free layout. */
function isExamPath(pathname: string) {
  return pathname.startsWith("/attempt/");
}

function isAppPath(pathname: string) {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Chooses the chrome for the current route: distraction-free exam layout,
 * the authenticated sidebar shell, or the public marketing header/footer.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, isAdmin, loading } = useAuth();
  const { isOrgAdmin } = useOrgAccess();

  if (isExamPath(pathname)) {
    return <div className="flex min-h-dvh flex-col bg-surface">{children}</div>;
  }

  const inApp = Boolean(session) || (loading && isAppPath(pathname)) || isAppPath(pathname);

  if (inApp) {
    const adminArea = isAdmin && pathname.startsWith("/admin");
    const groups: NavGroup[] = adminArea
      ? [{ heading: "Administration", items: adminNav }]
      : [
          { heading: "Practice", items: studentNav.slice(0, 6) },
          { heading: "Resources and account", items: studentNav.slice(6) },
          ...(isOrgAdmin ? [{ heading: "Organisation", items: organizationNav }] : []),
        ];
    const utility = adminArea
      ? adminUtilityNav
      : isAdmin
        ? [...studentUtilityNav, { ...adminNav[0]!, label: "Admin portal" }]
        : studentUtilityNav;

    return (
      <AppLayout
        groups={groups}
        utility={utility}
        navLabel={adminArea ? "Administration navigation" : "Student navigation"}
        areaLabel={adminArea ? "Administrator portal" : "Student portal"}
      >
        {children}
      </AppLayout>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <PublicHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
