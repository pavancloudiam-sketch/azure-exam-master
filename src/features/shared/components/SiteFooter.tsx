import { Link } from "@tanstack/react-router";

import { useAppSettings } from "../hooks/use-app-settings";

export function SiteFooter() {
  // Falls back to the compiled branding values if the settings read fails.
  const settings = useAppSettings();
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground">
        <p>{settings.footer_disclaimer}</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-4">
          <Link to="/pricing" className="hover:text-primary">
            Pricing
          </Link>
          <Link to="/legal/$docSlug" params={{ docSlug: "terms" }} className="hover:text-primary">
            Terms of Service
          </Link>
          <Link to="/legal/$docSlug" params={{ docSlug: "privacy" }} className="hover:text-primary">
            Privacy Policy
          </Link>
          <Link to="/legal/$docSlug" params={{ docSlug: "refunds" }} className="hover:text-primary">
            Refund Policy
          </Link>
        </nav>
        <p className="text-xs">
          Payments are not active. Policy pages are placeholder drafts and are not legal advice.
        </p>
        <p className="text-xs">
          {settings.application_name} v{settings.application_version} &middot;{" "}
          <a href={`mailto:${settings.support_email}`} className="hover:text-primary">
            {settings.support_email}
          </a>
        </p>
      </div>
    </footer>
  );
}
