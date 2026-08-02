import { Link } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NavItem } from "./ui/navigation";

export type NavGroup = { heading: string; items: NavItem[] };

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        collapsed ? "justify-center px-0" : ""
      }`}
      activeProps={{
        className: "bg-surface font-semibold text-primary",
        "aria-current": "page",
      }}
      activeOptions={{ exact: item.exact ?? false }}
    >
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/**
 * Role-aware sidebar body. Rendered both in the desktop rail and inside the
 * mobile drawer; the caller decides which navigation groups to pass in.
 */
export function AppSidebar({
  groups,
  utility,
  label,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  footer,
}: {
  groups: NavGroup[];
  utility?: NavItem[];
  label: string;
  collapsed?: boolean;
  onToggleCollapse?: (() => void) | undefined;
  onNavigate?: (() => void) | undefined;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <nav aria-label={label} className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.heading} className="mb-4">
            {!collapsed ? (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.heading}
              </p>
            ) : (
              <span className="sr-only">{group.heading}</span>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        {utility && utility.length > 0 ? (
          <ul className="mb-2 space-y-1">
            {utility.map((item) => (
              <li key={item.to}>
                <NavLink item={item} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        ) : null}
        {footer}
        {onToggleCollapse ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className="mt-1 hidden min-h-11 w-full justify-start gap-3 text-muted-foreground lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden="true" />
            )}
            {!collapsed ? <span>Collapse</span> : null}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
