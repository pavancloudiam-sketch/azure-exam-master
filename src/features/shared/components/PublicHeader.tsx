import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppSettings } from "../hooks/use-app-settings";
import { publicNav } from "./ui/navigation";

/**
 * Marketing header for signed-out visitors. The left side carries public
 * navigation; the right side is reserved for authentication actions only.
 */
export function PublicHeader() {
  const settings = useAppSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation menu"
                className="min-h-11 min-w-11 md:hidden"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-6">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Site navigation">
                <ul className="space-y-1">
                  {publicNav.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-primary"
                        activeProps={{ className: "bg-surface text-primary", "aria-current": "page" }}
                        activeOptions={{ exact: item.exact ?? false }}
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-lg font-semibold text-primary">
              {settings.application_name}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {settings.tagline}
            </span>
          </Link>

          <nav aria-label="Main navigation" className="ml-6 hidden md:block">
            <ul className="flex items-center gap-1">
              {publicNav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-primary"
                    activeProps={{ className: "bg-surface text-primary", "aria-current": "page" }}
                    activeOptions={{ exact: item.exact ?? false }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/auth"
            className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-surface"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create account
          </Link>
        </div>
      </div>
    </header>
  );
}
