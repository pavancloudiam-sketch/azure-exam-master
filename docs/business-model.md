# Phase 4 — commercial data model

Money is stored as integers in paise. Currency is constrained to `INR`; the
launch jurisdiction is India only and there is no global tax configuration.
No payment provider is configured and no charge can be taken.

## Catalogue
| Table | Purpose |
| --- | --- |
| `products` | Purchasable items. `product_type` is `one_time_exam` or `subscription`. `access_scope` (`exam` / `certification` / `all`) plus `exam_id` / `certification_id` describe what the product unlocks; `access_days` sets one-time access duration. |
| `prices` | Amount in paise for a product. `billing_interval` is `NULL` for one-time products, `month` or `year` for plans. |
| `coupons` | Percentage or fixed-amount discounts with validity window, total cap and per-student cap. |

## Transactions
| Table | Purpose |
| --- | --- |
| `orders` | One purchase intent per row: status, subtotal, discount, tax (captured, never computed), total and optional coupon. |
| `order_items` | Line items with the product name captured at purchase time so history survives catalogue edits. |
| `payment_attempts` | Every attempt against an order: provider, provider reference, status, failure code. Card data and gateway secrets are never stored. |
| `refunds` | Requested / approved / rejected / processed refunds with the deciding admin and reason. |
| `invoices` | Unique invoice number, totals, and a placeholder `tax_breakdown` — GST treatment is unconfirmed. |
| `coupon_redemptions` | Which student used which coupon on which order. |

## Access
| Table | Purpose |
| --- | --- |
| `subscriptions` | A student's plan state, current period and cancellation flag. |
| `entitlements` | The single source of truth for what a student may access, with source (`order`, `subscription`, `manual_grant`, `promotional`), scope, start and expiry. |

`public.has_exam_access(_user_id, _exam_id)` resolves scope, expiry and status.
Entitlements are not writable from the browser, so this can be trusted for
future paid-content gating. The exam engine is unchanged and is not gated yet.

## Legal consent
| Table | Purpose |
| --- | --- |
| `legal_documents` | Versioned Terms of Service, Privacy Policy and Refund Policy. One `is_current` row per type, `is_placeholder` marks unreviewed drafts. |
| `legal_acceptances` | Which student accepted which document version, in which context (`registration`, `checkout`, `reacceptance`) and when. |

`public.accept_current_legal_documents(_context)` records acceptance for the
signed-in user only; the browser cannot choose the user, version or timestamp.
Registration requires the acceptance checkbox; if the account needs email
confirmation first, the tick is replayed at the next successful sign-in.

## Audit
`financial_audit_logs` is an append-only record of financial and entitlement
actions (actor, action, entity, amount, details), readable by admins only.

## Access rules
- Products, prices and legal documents are publicly readable.
- Orders, order items, payments, refunds, invoices, redemptions, subscriptions,
  entitlements and acceptances are readable only by their owner or an admin.
- No table in this model grants `INSERT` or `UPDATE` on financial records to
  students; those writes will be made by server-side logic in a later phase.

## Subscriptions, refunds, receipts and messages (test mode)

### Subscriptions
`/billing` shows plan, status, current period and renewal state. A student may
request cancellation at period end (`cancel_at_period_end`) and withdraw the
request while the period is still running. A scheduled routine expires ended
subscriptions and revokes the entitlements they granted, so access is removed
when access rights lapse rather than lingering.

### Refunds
1. Student requests a refund with a reason from a paid order (`requested`).
2. Admin approves or rejects it on `/admin/billing`, with a note (`approved` /
   `rejected`).
3. Admin marks an approved refund processed once money has actually moved
   (`processed`); this revokes the entitlements the order granted.

All three steps are recorded in `financial_audit_logs`. Students read only
their own refunds; only admins can decide one.

### Receipts
Every paid order gets a receipt row with buyer name, address, PIN code and an
optional 15-character GST number kept on the student's billing profile, plus a
tax breakdown block. Receipts are downloadable from `/billing` as a printable
document, and they are clearly labelled **issued by AskMeExam**. They are not
Microsoft credentials, they are not tax filings, and the format has **not** been
reviewed by a professional for GST or invoicing compliance — see
`docs/launch-checklist-india.md`.

### Messages
`email_notifications` queues one row per event with a unique idempotency key
(`purchase_confirmation`, `payment_failure`, `refund_status`, `exam_reminder`,
`result_available`). Because the key is unique, a retry or a repeated page view
never queues a second message. Students read their own messages on `/billing`;
admins see the whole queue and record delivery on `/admin/billing`. No mail
provider is connected, so delivery is recorded rather than actually sent.

### Test-mode orders
`/admin/billing` can simulate a paid or failed order for a student, producing
the order, payment attempt, receipt, entitlement and messages without any money
moving.

## Not built in this phase
Real checkout, payment provider integration, live mail delivery, PDF receipt
rendering, coupon application logic and automatic tax filing. See
`docs/launch-checklist-india.md` before any of it is switched on.