# Commercial launch checklist — India

**Status: none of the items below are complete. Payments are NOT active.**

This checklist exists so that no commercial launch happens on assumptions. Every
item requires written confirmation from a qualified professional (chartered
accountant, tax practitioner, lawyer, or the payment provider's onboarding team)
before it may be ticked. Nothing in this repository — including the placeholder
policy documents — is legal, tax or accounting advice, and none of it satisfies a
legal or regulatory requirement on its own.

The initial commercial jurisdiction is **India only**. There is deliberately no
global tax configuration in the data model: `orders.tax_minor`,
`invoices.tax_minor` and `invoices.tax_breakdown` are captured but never
computed.

## 1. Payment-gateway KYC
- [ ] Payment provider selected and onboarding started.
- [ ] Business identity documents submitted and KYC approved in writing.
- [ ] Settlement bank account verified.
- [ ] Confirmed by: ______________________  Date: ____________

## 2. Merchant-account requirements
- [ ] Legal entity type confirmed (proprietorship / LLP / private limited).
- [ ] Business registration, PAN and bank proofs accepted by the provider.
- [ ] Website requirements met (contact details, policy pages, pricing display).
- [ ] Settlement cycle, fees and chargeback liability understood in writing.
- [ ] Confirmed by: ______________________  Date: ____________

## 3. GST applicability and registration
- [ ] GST applicability to online educational practice content assessed.
- [ ] Registration threshold and OIDAR position assessed.
- [ ] GSTIN obtained, or a documented written opinion that none is required.
- [ ] Place-of-supply rules for B2C and B2B customers confirmed.
- [ ] Confirmed by: ______________________  Date: ____________

## 4. Tax treatment
- [ ] Applicable GST rate and HSN/SAC code confirmed.
- [ ] Invoice content requirements confirmed (seller details, GSTIN, tax split).
- [ ] Whether displayed prices are tax-inclusive or tax-exclusive decided.
- [ ] TDS/TCS and income-tax treatment of platform revenue confirmed.
- [ ] Return-filing calendar and responsible person agreed.
- [ ] Confirmed by: ______________________  Date: ____________

## 5. Consumer-protection obligations
- [ ] Consumer Protection Act and e-commerce rules obligations reviewed.
- [ ] Mandatory seller disclosures published (legal name, address, contact).
- [ ] Grievance officer appointed, named and published with response timelines.
- [ ] Cancellation and refund rights for digital goods confirmed and reflected in
      the Refund Policy.
- [ ] Pricing, inclusive-of-tax display and no-hidden-charges review completed.
- [ ] Confirmed by: ______________________  Date: ____________

## 6. Privacy obligations
- [ ] Digital Personal Data Protection Act obligations reviewed.
- [ ] Notice and consent wording reviewed by a practitioner.
- [ ] Processor list (hosting, database, auth, AI model provider) published.
- [ ] Retention periods, deletion process and rights-request workflow defined.
- [ ] Breach-notification process and grievance contact defined.
- [ ] Cross-border transfer position confirmed for all processors.
- [ ] Confirmed by: ______________________  Date: ____________

## 7. Before payments are switched on
- [ ] All three policy documents replaced with professionally reviewed versions
      and published as new versions (`is_placeholder = false`), so students
      re-accept the reviewed text.
- [ ] Payment provider integrated, tested in its test environment, and the
      `payment_attempts.provider` value updated from `unconfigured`.
- [ ] Entitlement grant path verified end to end on a test order.
- [ ] Refund path verified end to end on a test order.
- [ ] Financial audit logging verified for order, payment, refund, invoice,
      coupon and entitlement actions.