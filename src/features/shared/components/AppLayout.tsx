import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar, type NavGroup } from "./AppSidebar";
import { useAppSettings } from "../hooks/use-app-settings";
import type { NavItem } from "./ui/navigation";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useTenantBranding } from "@/features/organizations/hooks/use-tenant-branding";
import { supabase } from "@/integrations/supabase/client";

function initialsFor(value: string) {
  const cleaned = value.split("@")[0] ?? value;
  const parts = cleaned.split(/[.\-_\s]+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join("") || "U").toUpperCase();
}

/** Resolves the current page title from the navigation definitions. */
function useCurrentTitle(groups: NavGroup[], utility: NavItem[], fallback: string) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const all = [...groups.flatMap((g) => g.items), ...utility];
  const match = all
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? fallback;
}

/**
 * Authenticated application shell: persistent left navigation, slim top bar
 * and a mobile drawer. Navigation content is supplied by the caller so the
 * student and administrator experiences stay fully separate.
 */
export function AppLayout({
  groups,
  utility = [],
  navLabel,
  areaLabel,
  children,
}: {
  groups: NavGroup[];
  utility?: NavItem[];
  navLabel: string;
  areaLabel: string;
  children: React.ReactNode;
}) {
  const settings = useAppSettings();
  const { theme, isTenantThemed } = useTenantBranding();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const title = useCurrentTitle(groups, utility, areaLabel);

  const appName = isTenantThemed ? theme.app_name : settings.application_name;
  const logoUrl = isTenantThemed ? theme.logo_url : null;
  const email = user?.email ?? "";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const brand = (
    <Link to="/" className="flex min-w-0 items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt={appName} className="h-7 w-auto max-w-[150px] object-contain" />
      ) : (
        <span className="truncate text-base font-semibold text-primary">{appName}</span>
      )}
    </Link>
  );

  return (
    <div className="flex min-h-dvh bg-surface">
      {/* Desktop rail */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-background lg:flex ${
          collapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        <div className="flex h-14 items-center border-b border-border px-4">
          {collapsed ? (
            <Link to="/" aria-label={appName} className="mx-auto text-base font-bold text-primary">
              {appName.slice(0, 1)}
            </Link>
          ) : (
            brand
          )}
        </div>
        <div className="min-h-0 flex-1">
          <AppSidebar
            groups={groups}
            utility={utility}
            label={navLabel}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((v) => !v)}
            footer={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSignOut()}
                className={`min-h-11 w-full gap-3 text-muted-foreground ${collapsed ? "justify-center" : "justify-start"}`}
              >
                <LogOut className="size-4" aria-hidden="true" />
                {collapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
              </Button>
            }
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-14 justify-center border-b border-border px-4 text-left">
            <SheetTitle className="text-base text-primary">{appName}</SheetTitle>
          </SheetHeader>
          <AppSidebar
            groups={groups}
            utility={utility}
            label={navLabel}
            onNavigate={() => setDrawerOpen(false)}
            footer={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSignOut()}
                className="min-h-11 w-full justify-start gap-3 text-muted-foreground"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            }
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation menu"
            className="min-h-11 min-w-11 lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{areaLabel}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="min-h-11 gap-2 px-2"
                aria-label="Account menu"
              >
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                >
                  {initialsFor(email)}
                </span>
                <span className="hidden max-w-[12rem] truncate text-sm sm:block">{email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                {email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/privacy">Privacy</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/help">Help and support</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {children}
      </div>
    </div>
  );
}
