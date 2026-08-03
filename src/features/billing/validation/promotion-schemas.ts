import { z } from "zod";

/** Promotions are authored and displayed in IST; the server stores UTC. */
export const IST_OFFSET = "+05:30";

/** Combines a `yyyy-mm-dd` date and `HH:mm` time into an IST-anchored ISO string. */
export function istToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00${IST_OFFSET}`).toISOString();
}

/** Splits a stored timestamp back into IST date and time inputs. */
export function isoToIstParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

const rupees = z
  .string()
  .trim()
  .min(1, { message: "Enter a promotional price" })
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), { message: "Use a plain amount such as 300 or 299.50" });

export const promotionFormSchema = z
  .object({
    product_id: z.string().uuid({ message: "Choose a product" }),
    name: z
      .string()
      .trim()
      .min(3, { message: "Give the offer a name students will understand" })
      .max(80, { message: "Keep the name under 80 characters" }),
    description: z.string().trim().max(300, { message: "Keep it under 300 characters" }),
    promo_rupees: rupees,
    regular_minor: z.number().int().positive(),
    starts_date: z.string().min(1, { message: "Choose a start date" }),
    starts_time: z.string().min(1, { message: "Choose a start time" }),
    ends_date: z.string().min(1, { message: "Choose an end date" }),
    ends_time: z.string().min(1, { message: "Choose an end time" }),
    is_active: z.boolean(),
    allow_coupon_stacking: z.boolean(),
    priority: z.number().int().min(0).max(100),
  })
  .superRefine((v, ctx) => {
    const minor = Math.round(Number(v.promo_rupees) * 100);
    if (minor <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["promo_rupees"],
        message: "The promotional price must be more than zero",
      });
    }
    if (minor >= v.regular_minor) {
      ctx.addIssue({
        code: "custom",
        path: ["promo_rupees"],
        message: "The promotional price must be lower than the regular price",
      });
    }
    const start = new Date(istToIso(v.starts_date, v.starts_time)).getTime();
    const end = new Date(istToIso(v.ends_date, v.ends_time)).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      ctx.addIssue({ code: "custom", path: ["ends_date"], message: "Enter a valid date and time" });
      return;
    }
    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["ends_date"],
        message: "The offer must end after it starts",
      });
    }
  });

export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

/** Field-keyed messages so each input can show its own error. */
export function promotionFieldErrors(values: PromotionFormValues) {
  const result = promotionFormSchema.safeParse(values);
  if (result.success) return null;
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
