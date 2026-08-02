import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useAppSettings } from "../hooks/use-app-settings";
import { MobileNav } from "./ui/MobileNav";
import { accountNav, adminNav, mainNav } from "./ui/navigation";
import { SecondaryButton } from "./ui/buttons";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useTenantBranding } from "@/features/organizations/hooks/use-tenant-branding";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const settings = useAppSettings();
  const { theme, isTenantThemed } = useTenantBranding();
  const { session, isAdmin, loading } = useAuth();
  // Tenant branding replaces the platform wordmark for members of a branded
  // organisation; platform admin areas keep the stock identity.
  const appName = isTenantThemed ? theme.app_name : settings.application_name;
  const tagline = isTenantThemed ? theme.tagline : settings.tagline;
  const logoUrl = isTenantThemed ? theme.logo_url : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = session
    ? isAdmin
      ? [...mainNav, ...accountNav, ...adminNav]
      : [...mainNav, ...accountNav]
    : mainNav;

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav items={items} />
          <Link to="/" className="flex min-w-0 flex-col leading-tight">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="h-8 w-auto max-w-[180px] object-contain" />
            ) : (
              <span className="text-lg font-semibold text-primary">{appName}</span>
            )}
            <span className="truncate text-xs text-muted-foreground">{tagline}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Main navigation" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-primary"
                    activeProps={{ className: "bg-surface text-primary", "aria-current": "page" }}
                    activeOptions={{ exact: item.to === "/" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {loading ? null : session ? (
            <SecondaryButton size="sm" onClick={handleSignOut}>
              Sign out
            </SecondaryButton>
          ) : (
            <Link
              to="/auth"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
