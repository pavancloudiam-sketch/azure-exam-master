import { Link } from "@tanstack/react-router";

import { useAppSettings } from "../hooks/use-app-settings";

/** Minimal public footer: disclaimer, policies, support and version. */
export function SiteFooter() {
  const settings = useAppSettings();
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-semibold text-primary">{settings.application_name}</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/legal/$docSlug" params={{ docSlug: "terms" }} className="hover:text-primary">
              Terms of Service
            </Link>
            <Link
              to="/legal/$docSlug"
              params={{ docSlug: "privacy" }}
              className="hover:text-primary"
            >
              Privacy Policy
            </Link>
            <Link
              to="/legal/$docSlug"
              params={{ docSlug: "refunds" }}
              className="hover:text-primary"
            >
              Refund Policy
            </Link>
            <a href={`mailto:${settings.support_email}`} className="hover:text-primary">
              {settings.support_email}
            </a>
          </nav>
        </div>
        <p className="text-xs">{settings.footer_disclaimer}</p>
        <p className="text-xs">
          {settings.application_name} v{settings.application_version}
        </p>
      </div>
    </footer>
  );
}
