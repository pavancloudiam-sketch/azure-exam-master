import { supabase } from "@/integrations/supabase/client";

import type { OrganizationBranding } from "../types";
import type { OrganizationBrandingInput } from "../validation";
import type { BrandingTheme } from "./branding-theme";

/**
 * All reads and writes below are additionally constrained by row level
 * security: only members of the organisation can read its branding and only
 * organisation owners/admins can change it, so a tampered id in the browser
 * still cannot reach another tenant's row.
 */
export async function getOrganizationBranding(
  organizationId: string,
): Promise<OrganizationBranding | null> {
  const { data, error } = await supabase
    .from("organization_branding")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function nullIfBlank(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

export async function saveOrganizationBranding(
  organizationId: string,
  input: OrganizationBrandingInput,
): Promise<OrganizationBranding> {
  const payload = {
    organization_id: organizationId,
    app_name: (input.app_name ?? "").trim(),
    tagline: (input.tagline ?? "").trim(),
    logo_url: nullIfBlank(input.logo_url),
    favicon_url: nullIfBlank(input.favicon_url),
    primary_color: input.primary_color.toLowerCase(),
    accent_color: input.accent_color.toLowerCase(),
    background_color: input.background_color.toLowerCase(),
    surface_color: input.surface_color.toLowerCase(),
    foreground_color: input.foreground_color.toLowerCase(),
    theme_mode: input.theme_mode,
    email_from_name: (input.email_from_name ?? "").trim(),
    email_reply_to: nullIfBlank(input.email_reply_to),
    email_header_color: input.email_header_color.toLowerCase(),
    email_footer_text: (input.email_footer_text ?? "").trim(),
    support_email: nullIfBlank(input.support_email),
    custom_domain: nullIfBlank(input.custom_domain)?.toLowerCase() ?? null,
    is_published: input.is_published === "yes",
  };

  const { data, error } = await supabase
    .from("organization_branding")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function resetOrganizationBranding(organizationId: string) {
  const { error } = await supabase
    .from("organization_branding")
    .delete()
    .eq("organization_id", organizationId);
  if (error) throw error;
}

/**
 * Resolves the theme for a verified, published custom domain. Runs through a
 * security-definer lookup that returns presentation fields only, so an
 * unauthenticated visitor never learns anything about the tenant itself.
 */
export async function resolveBrandingForHost(host: string): Promise<BrandingTheme | null> {
  const { data, error } = await supabase.rpc("get_branding_for_domain", { _host: host });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? (row as BrandingTheme) : null;
}