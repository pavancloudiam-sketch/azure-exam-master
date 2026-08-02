/**
 * Redaction is applied to every value before it leaves the browser or is
 * written to a server log. The allow-list mindset is deliberate: context is
 * limited to short scalars, and anything whose key looks sensitive is dropped
 * outright rather than masked, so it can never be reconstructed from logs.
 */

/** Keys that must never appear in a log record, in any casing. */
const FORBIDDEN_KEY_PATTERNS = [
  /pass(word|phrase)?/i,
  /token/i,
  /secret/i,
  /\bkey\b/i,
  /apikey/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /jwt/i,
  /bearer/i,
  /credential/i,
  /answer/i, // correct-answer payloads and answer keys
  /option_ids?/i,
  /is_correct/i,
  /explanation/i,
  /email/i,
  /full_name/i,
  /phone/i,
];

/** Values that look like credentials even under an innocent key. */
const SENSITIVE_VALUE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\./, // JWT
  /\bsb_(publishable|secret)_[A-Za-z0-9_-]+/,
  /\bBearer\s+\S+/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email address
];

const MAX_VALUE_LENGTH = 200;

export function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/** Masks credential-shaped substrings and truncates long text. */
export function redactText(value: string): string {
  let output = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    output = output.replaceAll(new RegExp(pattern, "gi"), "[redacted]");
  }
  return output.length > MAX_VALUE_LENGTH ? `${output.slice(0, MAX_VALUE_LENGTH)}…` : output;
}

/** Drops forbidden keys, keeps short scalars, redacts credential-shaped text. */
export function redactContext(
  input: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!input) return undefined;
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isForbiddenKey(key)) continue;
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      output[key] = value;
    } else if (typeof value === "string") {
      output[key] = redactText(value);
    }
    // Objects, arrays and functions are dropped: nested payloads are the most
    // common way answer keys and personal data leak into logs.
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

/** Route path without query string or hash — redirect targets can carry data. */
export function redactRoute(pathname: string): string {
  return pathname.split("?")[0]!.split("#")[0]!;
}
