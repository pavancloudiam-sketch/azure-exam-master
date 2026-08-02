import type { InvoiceDetail } from "../types";
import { formatInr } from "../types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/**
 * Builds a self-contained receipt document. The format is a plain business
 * receipt issued by AskMeExam; it has NOT been reviewed by a tax or legal
 * professional and must not be presented as a compliant tax invoice.
 */
export function buildReceiptHtml(invoice: InvoiceDetail, buyerEmail: string): string {
  const items = (invoice.orders?.order_items ?? [])
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.product_name)}</td><td class="n">${i.quantity}</td><td class="n">${formatInr(
          i.total_minor,
        )}</td></tr>`,
    )
    .join("");

  const row = (label: string, value: string) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Receipt ${escapeHtml(invoice.invoice_number)} — AskMeExam</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;color:#12213f;margin:40px;}
 h1{font-size:20px;margin:0 0 4px;} .muted{color:#5b6780;font-size:12px;}
 table{border-collapse:collapse;width:100%;margin-top:16px;font-size:13px;}
 td,th{border-bottom:1px solid #dfe4ec;padding:8px;text-align:left;}
 .n{text-align:right;} .total{font-weight:700;}
 .note{margin-top:24px;padding:12px;border:1px solid #dfe4ec;font-size:12px;color:#5b6780;}
</style></head>
<body>
 <h1>AskMeExam — Receipt</h1>
 <p class="muted">Issued by AskMeExam. AskMeExam is an independent practice platform and is not
 affiliated with or endorsed by Microsoft. Any certificate or result issued here is an
 AskMeExam-issued practice document, not a Microsoft credential.</p>
 <table>
  ${row("Receipt number", invoice.invoice_number)}
  ${row("Status", invoice.status)}
  ${row("Order", invoice.orders?.order_number ?? "")}
  ${row("Issued", invoice.issued_at ? new Date(invoice.issued_at).toLocaleString() : "—")}
  ${row("Billed to", buyerEmail)}
  ${row("Place of supply", invoice.place_of_supply ?? "Not provided")}
  ${row("Buyer GST number", invoice.buyer_gstin ?? "Not provided")}
 </table>
 <table>
  <thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead>
  <tbody>${items}</tbody>
  <tfoot>
   <tr><td colspan="2">Subtotal</td><td class="n">${formatInr(invoice.subtotal_minor)}</td></tr>
   <tr><td colspan="2">Discount</td><td class="n">-${formatInr(invoice.discount_minor)}</td></tr>
   <tr><td colspan="2">Tax</td><td class="n">${formatInr(invoice.tax_minor)}</td></tr>
   <tr class="total"><td colspan="2">Total</td><td class="n">${formatInr(invoice.total_minor)}</td></tr>
  </tfoot>
 </table>
 <p class="note">${escapeHtml(invoice.tax_note)} Tax is not calculated or filed automatically.
 This document has not been confirmed as a legally compliant tax invoice; professional review is
 required before commercial launch.</p>
</body></html>`;
}

export function downloadReceipt(invoice: InvoiceDetail, buyerEmail: string): void {
  const blob = new Blob([buildReceiptHtml(invoice, buyerEmail)], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `askmeexam-receipt-${invoice.invoice_number}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}