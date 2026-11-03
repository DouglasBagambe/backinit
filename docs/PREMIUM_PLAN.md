# Premium launch proposal

Status: deferred by owner for one working week of using/testing the current site. No premium UI or checkout in this delivery. Proposal only, not a live purchase offering. Owner has no approved payment provider yet. Updated 3 November 2026.

## Price recommendation

Start at UGX 5,000 for one month or UGX 50,000 for one year. Annual saves UGX 10,000 compared with twelve monthly purchases. Validate conversion, ad revenue displaced per subscriber, processor fees and support costs before revising pricing. Do not enable recurring collection until the provider and customer explicitly support it.

Premium removes BackInIt-owned advertising. Third-party embedded player advertising cannot be promised away without a supported ad-free provider arrangement. This scope must be visible before purchase.

## Provider blocker and options

Flutterwave's current public signup offers Nigeria only, with “For other countries click here” leading to Contact Sales. The owner's existing onboarding Country field is disabled at Nigeria. Do not proceed with inaccurate business details. Uganda processing documentation is not proof of current self-service merchant eligibility.

Flutterwave's Uganda pricing lists 3% mobile-money collections and 4.8% cards, excluding VAT/other applicable taxes. On a UGX 5,000 collection these are UGX 150 or UGX 240 before taxes. Settlement/transfer fees are separate; batch settlements rather than treating each subscription as its own transfer.

Pesapal has Uganda merchant onboarding, mobile money and cards. Obtain a written merchant quote, settlement terms, permitted-business approval and supported renewal methods before choosing it. Its Uganda FAQ says merchant agreement/documentation are required for live processing and settlements go to a bank account in the country of registration. Do not assume it is cheaper or supports automatic mobile-money subscriptions.

Official references:

- [Flutterwave signup](https://onboarding.flutterwave.com/signup)
- [Flutterwave Uganda fees](https://www.flutterwave.com/ug/pricing)
- [Flutterwave other-country sales route](https://flutterwave.com/contact-sales)
- [Pesapal Uganda merchant FAQ](https://www.pesapal.com/ug/business/faqs)

## Implementation after provider eligibility

1. Owner completes correct-country merchant onboarding, identity and agreement steps. No credentials or identity documents in Git.
2. Use sandbox credentials first. Server creates orders from configured prices; browser redirects cannot grant access.
3. Verify payment status, amount, currency, account and order reference server-side. Handle signed provider notifications, duplicate deliveries and replay protection.
4. Store entitlement start/end, provider reference and payment audit state. Extend access only once for each verified successful payment.
5. Add expiry, cancellation, renewal reminders, refund handling and account billing controls with accurate renewal terms.
6. Suppress every BackInIt ad placement using verified entitlement, including match rooms, trackers and Multiview. Test active, expired, refunded and signed-out states.
7. Verify real merchant eligibility and one owner-authorized transaction before enabling public sales.
