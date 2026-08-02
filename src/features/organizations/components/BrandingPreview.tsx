import * as React from "react";

import { themeCssVars, type BrandingTheme } from "../services/branding-theme";

/**
 * Sandboxed preview surface. The tenant theme is applied to this container
 * only, so previewing never leaks into the surrounding admin chrome.
 */
export function BrandingPreview({ theme }: { theme: BrandingTheme }) {
  const style = themeCssVars(theme) as React.CSSProperties;

  return (
    <div
      style={style}
      className="overflow-hidden rounded-lg border border-border bg-background text-foreground"
      aria-label="Branding preview"
    >
      <div className="flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2 min-w-0">
          {theme.logo_url ? (
            <img
              src={theme.logo_url}
              alt={`${theme.app_name} logo`}
              className="h-7 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span className="truncate text-sm font-semibold">{theme.app_name}</span>
          )}
        </div>
        <nav className="hidden gap-3 text-xs sm:flex" aria-hidden="true">
          <span>Dashboard</span>
          <span>Exams</span>
          <span>Results</span>
        </nav>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold">{theme.app_name}</h3>
          <p className="text-sm text-muted-foreground">{theme.tagline}</p>
        </div>

        <div className="rounded-md border border-border bg-card p-4 text-card-foreground">
          <p className="text-sm font-medium">SC-300 practice exam</p>
          <p className="mt-1 text-xs text-muted-foreground">60 questions · 90 minutes</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              Start exam
            </span>
            <span className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
              Review answers
            </span>
            <span className="rounded-md border border-border px-3 py-1.5 text-xs">Secondary</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {theme.favicon_url ? (
            <img src={theme.favicon_url} alt="" className="h-4 w-4 rounded-sm" />
          ) : (
            <span className="inline-block h-4 w-4 rounded-sm bg-accent" aria-hidden="true" />
          )}
          <span className="truncate">
            {theme.app_name} — {theme.tagline}
          </span>
        </div>
      </div>
    </div>
  );
}