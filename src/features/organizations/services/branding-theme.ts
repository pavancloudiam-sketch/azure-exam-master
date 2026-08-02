import type { OrganizationBranding } from "../types";

/** Presentation-only slice of branding, safe for unauthenticated custom-domain use. */
export type BrandingTheme = {
  app_name: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  foreground_color: string;
  theme_mode: string;
};

export const DEFAULT_THEME: BrandingTheme = {
  app_name: "AskMeExam",
  tagline: "Practice with Confidence.",
  logo_url: null,
  favicon_url: null,
  primary_color: "#1e3a5f",
  accent_color: "#2f7fd1",
  background_color: "#ffffff",
  surface_color: "#f4f6f9",
  foreground_color: "#111a2b",
  theme_mode: "light",
};

export function toTheme(branding: OrganizationBranding): BrandingTheme {
  return {
    app_name: branding.app_name || DEFAULT_THEME.app_name,
    tagline: branding.tagline || DEFAULT_THEME.tagline,
    logo_url: branding.logo_url,
    favicon_url: branding.favicon_url,
    primary_color: branding.primary_color,
    accent_color: branding.accent_color,
    background_color: branding.background_color,
    surface_color: branding.surface_color,
    foreground_color: branding.foreground_color,
    theme_mode: branding.theme_mode,
  };
}

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a #rrggbb colour. Returns 0 for malformed input. */
export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const int = Number.parseInt(match[1]!, 16);
  return (
    0.2126 * channel((int >> 16) & 255) +
    0.7152 * channel((int >> 8) & 255) +
    0.0722 * channel(int & 255)
  );
}

/** Picks black or white text so the pairing stays legible (WCAG contrast). */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? "#111a2b" : "#ffffff";
}

/**
 * Maps a tenant theme onto the design-system CSS variables. Returned as a
 * plain record so the same values drive both the live document and the
 * sandboxed preview surface.
 */
export function themeCssVars(theme: BrandingTheme): Record<string, string> {
  const mutedText = theme.theme_mode === "dark" ? "#a8b3c4" : "#5a6779";
  const border = theme.theme_mode === "dark" ? "#2b3648" : "#dfe4ec";
  return {
    "--background": theme.background_color,
    "--foreground": theme.foreground_color,
    "--card": theme.surface_color,
    "--card-foreground": theme.foreground_color,
    "--popover": theme.surface_color,
    "--popover-foreground": theme.foreground_color,
    "--primary": theme.primary_color,
    "--primary-foreground": readableOn(theme.primary_color),
    "--secondary": theme.surface_color,
    "--secondary-foreground": theme.foreground_color,
    "--muted": theme.surface_color,
    "--muted-foreground": mutedText,
    "--accent": theme.accent_color,
    "--accent-foreground": readableOn(theme.accent_color),
    "--accent-ink": theme.accent_color,
    "--border": border,
    "--input": border,
    "--ring": theme.accent_color,
  };
}
