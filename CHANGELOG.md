# Changelog

## 1.0.0 (2026-05-28)

### Features

- **Payments**: `liqpay_create_checkout_url`, `liqpay_get_payment_status` — hosted checkout & status queries
- **Reports**: `liqpay_get_payments_list` — transaction history by date range
- **Holds**: `liqpay_create_hold`, `liqpay_complete_hold`, `liqpay_cancel_hold` — 2-step payment flow
- **Refunds**: `liqpay_create_refund` — full or partial refunds
- **Subscriptions**: `liqpay_create_subscription`, `liqpay_cancel_subscription` — recurring payments
- **Payouts**: `liqpay_create_payout` — P2P card transfers
- **Webhooks**: `liqpay_verify_callback` — signature validation for incoming callbacks
