import { Link } from "@tanstack/react-router";

import { mainNav, type NavItem } from "./navigation";

export function NavSidebar({
  items = mainNav,
  heading = "Navigation",
  onNavigate,
}: {
  items?: NavItem[];
  heading?: string;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <nav aria-label={heading} className="w-full sm:w-60">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {heading}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-primary"
              activeProps={{ className: "bg-surface text-primary", "aria-current": "page" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}