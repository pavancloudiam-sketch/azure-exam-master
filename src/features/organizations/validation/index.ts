import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Enter an organisation name.").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Enter a short URL slug.")
    .max(60)
    .regex(/^[a-z0-9-]+$/i, "Use letters, numbers and hyphens only."),
  contact_email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .or(z.literal(""))
    .optional(),
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter the member's AskMeExam account email."),
  role: z.enum(["owner", "admin", "manager", "member"]),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const organizationSettingsSchema = z.object({
  timezone: z.string().trim().min(1, "Enter a timezone."),
  seat_limit: z
    .string()
    .trim()
    .regex(/^\d*$/, "Enter a whole number or leave blank.")
    .optional(),
  allow_domain_join: z.enum(["yes", "no"]),
  allowed_email_domains: z.string().trim().optional(),
});
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

const hexColor = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, `${label} must be a hex colour such as #1e3a5f.`);

const optionalUrl = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => value === "" || /^https:\/\/\S+$/i.test(value),
    "Use a full https:// URL or leave blank.",
  )
  .optional();

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine(
    (value) => value === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    "Enter a valid email address or leave blank.",
  )
  .optional();

export const organizationBrandingSchema = z.object({
  app_name: z.string().trim().max(60).optional(),
  tagline: z.string().trim().max(120).optional(),
  logo_url: optionalUrl,
  favicon_url: optionalUrl,
  primary_color: hexColor("Primary colour"),
  accent_color: hexColor("Accent colour"),
  background_color: hexColor("Background colour"),
  surface_color: hexColor("Surface colour"),
  foreground_color: hexColor("Text colour"),
  theme_mode: z.enum(["light", "dark"]),
  email_from_name: z.string().trim().max(60).optional(),
  email_reply_to: optionalEmail,
  email_header_color: hexColor("Email header colour"),
  email_footer_text: z.string().trim().max(400).optional(),
  support_email: optionalEmail,
  custom_domain: z
    .string()
    .trim()
    .max(253)
    .refine(
      (value) =>
        value === "" ||
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(value),
      "Enter a bare hostname such as exams.acme.com.",
    )
    .optional(),
  is_published: z.enum(["yes", "no"]),
});
export type OrganizationBrandingInput = z.infer<typeof organizationBrandingSchema>;