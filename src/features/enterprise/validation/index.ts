import { z } from "zod";

/** Only https endpoints are accepted: signatures do not protect plaintext transport. */
const httpsUrl = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an https:// URL");

export const ssoConfigSchema = z.object({
  method: z.enum(["password", "google", "entra_saml", "oidc"]),
  display_name: z.string().trim().max(120).optional().or(z.literal("")),
  email_domains: z.string().trim().optional().or(z.literal("")),
  metadata_url: z.string().trim().optional().or(z.literal("")),
  issuer_url: z.string().trim().optional().or(z.literal("")),
  client_id: z.string().trim().max(200).optional().or(z.literal("")),
  allowed_redirect_urls: z.string().trim().optional().or(z.literal("")),
  is_enforced: z.enum(["yes", "no"]),
});
export type SsoConfigInput = z.infer<typeof ssoConfigSchema>;

export const apiKeySchema = z.object({
  name: z.string().trim().min(2, "Give the key a recognisable name").max(120),
  scopes: z.string().trim().min(1, "Select at least one scope"),
  rate_limit_per_hour: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((v) => Number(v) > 0 && Number(v) <= 10000, "Between 1 and 10000"),
  expires_in_days: z
    .string()
    .trim()
    .regex(/^\d*$/, "Enter a whole number or leave blank")
    .optional()
    .or(z.literal("")),
});
export type ApiKeyInput = z.infer<typeof apiKeySchema>;

export const webhookSchema = z.object({
  name: z.string().trim().min(2, "Give the endpoint a name").max(120),
  target_url: httpsUrl,
  event_types: z.string().trim().min(1, "Select at least one event"),
});
export type WebhookInput = z.infer<typeof webhookSchema>;

/** Comma or newline separated free text into a clean, de-duplicated list. */
export function splitList(value: string | undefined | null): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}