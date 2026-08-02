import { describe, expect, it } from "vitest";

import { buildBrandedEmail } from "./branding-email";
import { DEFAULT_THEME, readableOn, themeCssVars } from "./branding-theme";
import type { OrganizationBranding } from "../types";

const branding = {
  app_name: "Acme Academy",
  logo_url: null,
  email_from_name: "Acme Learning",
  email_reply_to: "learning@acme.com",
  email_header_color: "#0b3d91",
  email_footer_text: "Acme internal use only.",
  support_email: "help@acme.com",
} as OrganizationBranding;

describe("branding theme", () => {
  it("picks legible text for dark and light brand colours", () => {
    expect(readableOn("#0b3d91")).toBe("#ffffff");
    expect(readableOn("#f4f6f9")).toBe("#111a2b");
  });

  it("maps tenant colours onto design-system variables", () => {
    const vars = themeCssVars({ ...DEFAULT_THEME, primary_color: "#0b3d91" });
    expect(vars["--primary"]).toBe("#0b3d91");
    expect(vars["--primary-foreground"]).toBe("#ffffff");
    expect(vars["--background"]).toBe(DEFAULT_THEME.background_color);
  });
});

describe("branded email", () => {
  it("uses the tenant sender identity and footer", () => {
    const email = buildBrandedEmail(branding, "Result ready", "You passed.");
    expect(email.fromName).toBe("Acme Learning");
    expect(email.replyTo).toBe("learning@acme.com");
    expect(email.html).toContain("#0b3d91");
    expect(email.html).toContain("Acme internal use only.");
    expect(email.text).toContain("You passed.");
  });

  it("falls back to platform identity when no tenant branding exists", () => {
    const email = buildBrandedEmail(null, "Result ready", "You passed.");
    expect(email.fromName).toBe("AskMeExam");
    expect(email.replyTo).toBeNull();
    expect(email.html).toContain("AskMeExam");
  });

  it("escapes untrusted content in both parts", () => {
    const email = buildBrandedEmail(null, "Hi <script>", "<img src=x onerror=1>");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;img src=x onerror=1&gt;");
  });
});
