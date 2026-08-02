import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  getOrganizationBranding,
  resolveBrandingForHost,
} from "../services/branding-service";
import { listMyMemberships } from "../services/organization-service";
import {
  DEFAULT_THEME,
  themeCssVars,
  toTheme,
  type BrandingTheme,
} from "../services/branding-theme";

type TenantBrandingState = {
  theme: BrandingTheme;
  /** True when a tenant theme is active rather than the platform default. */
  isTenantThemed: boolean;
};

const TenantBrandingContext = React.createContext<TenantBrandingState>({
  theme: DEFAULT_THEME,
  isTenantThemed: false,
});

export function useTenantBranding() {
  return React.useContext(TenantBrandingContext);
}

const THEMED_VAR_NAMES = Object.keys(themeCssVars(DEFAULT_THEME));

function applyTheme(theme: BrandingTheme | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!theme) {
    THEMED_VAR_NAMES.forEach((name) => root.style.removeProperty(name));
    root.removeAttribute("data-tenant-theme");
    return;
  }
  const vars = themeCssVars(theme);
  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
  root.setAttribute("data-tenant-theme", theme.theme_mode);
}

function applyIdentity(theme: BrandingTheme | null) {
  if (typeof document === "undefined") return;
  const name = theme?.app_name ?? DEFAULT_THEME.app_name;
  const tagline = theme?.tagline ?? DEFAULT_THEME.tagline;
  document.title = `${name} — ${tagline}`;

  const href = theme?.favicon_url ?? "/favicon.ico";
  let link = document.querySelector<HTMLLinkElement>("link[data-tenant-favicon]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-tenant-favicon", "");
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Applies the signed-in member's organisation branding to the running app.
 *
 * Two deliberate boundaries:
 *  - Platform administration routes (`/admin/*`) are never re-themed, so the
 *    global administrator always sees stock AskMeExam branding.
 *  - Branding is read through row level security for the caller's own
 *    organisation, or through the public custom-domain lookup which returns
 *    presentation fields only. One tenant can never load another's theme.
 */
export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPlatformAdminArea = pathname.startsWith("/admin");

  const [host, setHost] = React.useState<string | null>(null);
  React.useEffect(() => setHost(window.location.hostname), []);

  const domainQuery = useQuery({
    queryKey: ["tenant-branding", "host", host],
    queryFn: () => resolveBrandingForHost(host!),
    enabled: Boolean(host),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const membershipQuery = useQuery({
    queryKey: ["my-memberships"],
    queryFn: listMyMemberships,
    enabled: Boolean(user) && !loading,
    staleTime: 60 * 1000,
  });

  const activeOrgId =
    membershipQuery.data?.find((m) => m.status === "active")?.organization.id ?? null;

  const brandingQuery = useQuery({
    queryKey: ["tenant-branding", "org", activeOrgId],
    queryFn: () => getOrganizationBranding(activeOrgId!),
    enabled: Boolean(activeOrgId),
    staleTime: 60 * 1000,
  });

  const orgTheme =
    brandingQuery.data && brandingQuery.data.is_published ? toTheme(brandingQuery.data) : null;
  const activeTheme = isPlatformAdminArea ? null : (orgTheme ?? domainQuery.data ?? null);

  React.useEffect(() => {
    applyTheme(activeTheme);
    applyIdentity(activeTheme);
    return () => applyTheme(null);
  }, [activeTheme]);

  const value = React.useMemo<TenantBrandingState>(
    () => ({ theme: activeTheme ?? DEFAULT_THEME, isTenantThemed: Boolean(activeTheme) }),
    [activeTheme],
  );

  return (
    <TenantBrandingContext.Provider value={value}>{children}</TenantBrandingContext.Provider>
  );
}