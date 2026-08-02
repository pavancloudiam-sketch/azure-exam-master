/**
 * Pluggable email transport for the background queue worker.
 *
 * The provider is chosen with the `EMAIL_PROVIDER` environment variable:
 *
 *   console (default) — renders the message and logs a redacted line. Nothing
 *                       leaves the server; used until a provider is configured.
 *   resend            — posts to the Resend HTTP API using `RESEND_API_KEY`.
 *
 * `EMAIL_FROM_ADDRESS` supplies the envelope address; the display name comes
 * from the tenant branding builder so branded and platform mail share one
 * rendering path.
 */
export type EmailMessage = {
  to: string;
  fromName: string;
  fromAddress: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  /** Stable per notification — providers use it to de-duplicate retries. */
  idempotencyKey: string;
};

export type SendResult = { providerId: string | null };

export class RetryableEmailError extends Error {}
export class PermanentEmailError extends Error {}

export type EmailProvider = {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
};

const consoleProvider: EmailProvider = {
  name: "console",
  async send(message) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: "info",
        code: "queue.email_rendered",
        message: "Email rendered by the console provider (no transport configured)",
        source: "server",
        context: {
          idempotency_key: message.idempotencyKey,
          subject_length: message.subject.length,
          html_bytes: message.html.length,
        },
      }),
    );
    return { providerId: null };
  },
};

function resendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: `${message.fromName} <${message.fromAddress}>`,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });

      if (response.ok) {
        const body = (await response.json().catch(() => ({}))) as { id?: string };
        return { providerId: body.id ?? null };
      }

      const detail = `Provider responded with ${response.status}`;
      // 4xx other than 429 will never succeed on retry.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new PermanentEmailError(detail);
      }
      throw new RetryableEmailError(detail);
    },
  };
}

/** Resolves the configured provider. Read inside handlers, never at module scope. */
export function resolveEmailProvider(): EmailProvider {
  const configured = (process.env["EMAIL_PROVIDER"] ?? "console").toLowerCase();
  if (configured === "resend") {
    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) throw new PermanentEmailError("EMAIL_PROVIDER=resend but RESEND_API_KEY is unset");
    return resendProvider(apiKey);
  }
  return consoleProvider;
}

export function defaultFromAddress(): string {
  return process.env["EMAIL_FROM_ADDRESS"] ?? "no-reply@askmeexam.local";
}
