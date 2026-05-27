# API Reference

Complete reference for all 11 tools provided by liqpay-mcp-server.

## Authentication

All tools (except `liqpay_create_checkout_url` and `liqpay_verify_callback`) make server-to-server requests to LiqPay using:

```
data      = base64(JSON.stringify(payload))
signature = base64(SHA1(LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY))
```

Keys are read from environment variables `LIQPAY_PUBLIC_KEY` and `LIQPAY_PRIVATE_KEY`. The server exits immediately if either is missing.

---

## Payments

### `liqpay_create_checkout_url`

Generate a hosted checkout URL. The user is redirected to LiqPay's payment page — card data never passes through your server.

**No API call is made.** The URL is computed locally.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Payment amount (e.g. `99.99`) |
| `currency` | string | Yes | `UAH`, `USD`, or `EUR` |
| `description` | string | Yes | Shown to payer (max 500 chars) |
| `order_id` | string | Yes | Your unique order ID |
| `result_url` | string | No | Redirect after payment |
| `server_url` | string | No | Webhook URL for notification |
| `language` | string | No | `uk` or `en` (default: `uk`) |

**Response:**
```json
{
  "checkout_url": "https://www.liqpay.ua/api/3/checkout?data=...&signature=..."
}
```

---

### `liqpay_get_payment_status`

Fetch the current status of a payment by order ID.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | Yes | Order ID used at payment creation |

**Response:**
```json
{
  "status": "success",
  "payment_id": 1234567,
  "amount": 99.99,
  "currency": "UAH",
  "description": "Order #42",
  "create_date": 1716768000000,
  "end_date": 1716768060000,
  "transaction_id": 9876543
}
```

**Possible statuses:** `success`, `failure`, `error`, `wait_accept`, `processing`, `reversed`, `hold_wait`, `sandbox`

---

## Reports

### `liqpay_get_payments_list`

Retrieve transaction history filtered by date range.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | number | Yes | Start of range — Unix timestamp in ms |
| `date_to` | number | Yes | End of range — Unix timestamp in ms (max 31 days from `date_from`) |
| `status` | string | No | Filter: `success`, `failure`, `reversed`, etc. |

**Response:**
```json
{
  "count": 2,
  "data": [
    { "status": "success", "payment_id": 100, "amount": 500, "currency": "UAH", "order_id": "ord-1" },
    { "status": "success", "payment_id": 101, "amount": 200, "currency": "UAH", "order_id": "ord-2" }
  ]
}
```

> If the response exceeds the character limit, it is automatically truncated and a `truncation_message` is added. Narrow the date range or add a `status` filter to get full results.

---

## Holds (2-step payments)

> ⚠️ `liqpay_create_hold` accepts raw card data. Your merchant account must be PCI DSS compliant to use this action. For most cases, use `liqpay_create_checkout_url` instead.

### `liqpay_create_hold`

Pre-authorize (freeze) funds on a card without capturing them.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount to hold |
| `currency` | string | Yes | `UAH`, `USD`, or `EUR` |
| `description` | string | Yes | Description for the payer (max 500 chars) |
| `order_id` | string | Yes | Your unique order ID |
| `card` | string | Yes | Card number (16 digits) |
| `card_exp_month` | string | Yes | Expiry month `MM` |
| `card_exp_year` | string | Yes | Expiry year `YY` |
| `card_cvv` | string | Yes | CVV code |

**Response:**
```json
{
  "payment_id": 1234567,
  "status": "hold_wait",
  "amount": 99.99,
  "currency": "UAH"
}
```

---

### `liqpay_complete_hold`

Capture previously held funds. Completes the 2-step payment.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | Yes | Order ID from `liqpay_create_hold` |
| `amount` | number | No | Partial capture (≤ held amount); omit for full capture |

**Response:**
```json
{
  "status": "success",
  "payment_id": 1234567
}
```

---

### `liqpay_cancel_hold`

Release held funds back to the payer without capturing.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | Yes | Order ID from `liqpay_create_hold` |

**Response:**
```json
{
  "status": "reversed",
  "payment_id": 1234567
}
```

---

## Refunds

### `liqpay_create_refund`

Refund a completed payment — full or partial.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | Yes | Order ID of the original payment |
| `amount` | number | No | Amount to refund; omit for full refund |

**Response:**
```json
{
  "payment_id": 1234567,
  "status": "reversed",
  "amount": 99.99
}
```

---

## Subscriptions

### `liqpay_create_subscription`

Create a recurring payment subscription via hosted checkout.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount per billing cycle |
| `currency` | string | Yes | `UAH`, `USD`, or `EUR` |
| `description` | string | Yes | Subscription description (max 500 chars) |
| `order_id` | string | Yes | Your unique subscription ID |
| `subscribe_date_start` | string | Yes | First charge date `YYYY-MM-DD HH:mm:ss` |
| `subscribe_periodicity` | string | Yes | `day`, `week`, `month`, or `year` |
| `result_url` | string | No | Redirect after subscription setup |
| `server_url` | string | No | Webhook for recurring charge notifications |

**Response:**
```json
{
  "checkout_url": "https://www.liqpay.ua/api/3/checkout?data=...&signature=..."
}
```

---

### `liqpay_cancel_subscription`

Cancel an active recurring subscription.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | Yes | Subscription order ID |

**Response:**
```json
{
  "status": "unsubscribed"
}
```

---

## Payouts

### `liqpay_create_payout`

Send money directly to a card (P2P transfer). Requires the payout feature to be enabled on the merchant account.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Payout amount |
| `currency` | string | Yes | `UAH`, `USD`, or `EUR` |
| `description` | string | Yes | Purpose of payout (e.g. `'Salary — May 2026'`) |
| `order_id` | string | Yes | Your unique payout ID |
| `card` | string | Yes | Recipient card number (16 digits) |

**Response:**
```json
{
  "payment_id": 1234567,
  "status": "success",
  "amount": 500,
  "currency": "UAH"
}
```

---

## Webhooks

### `liqpay_verify_callback`

Validate an incoming LiqPay webhook to confirm it was not tampered with.

**No API call is made.** Verification is computed locally using your private key.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | Yes | Raw `data` field from the webhook POST body |
| `signature` | string | Yes | Raw `signature` field from the webhook POST body |

**Response (valid):**
```json
{
  "valid": true,
  "decoded_data": {
    "status": "success",
    "payment_id": 1234567,
    "amount": 99.99,
    "currency": "UAH",
    "order_id": "ord-42"
  }
}
```

**Response (invalid):**
```json
{
  "valid": false
}
```

---

## Error Responses

All tools return errors using the MCP `isError` flag:

```json
{
  "content": [{ "type": "text", "text": "Error [err_auth]: Bad key. Check that LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY are correct." }],
  "isError": true
}
```

| Error Code | Meaning | Action |
|------------|---------|--------|
| `err_auth` | Invalid API keys | Verify keys in LiqPay dashboard |
| `err_signature` | Signature mismatch | Ensure private key has no extra whitespace |
| `err_payment` | Payment could not be processed | Verify amount, currency, and card details |
| `err_limit` | Transaction limit exceeded | Try a smaller amount or contact LiqPay support |
| `err_shop_not_active` | Merchant account not active | Complete LiqPay onboarding |
| `err_order_id` | Invalid or duplicate order ID | Use a unique identifier per transaction |
| `err_refund` | Refund failed | Ensure original payment status is `success` |
| HTTP 401 | Authentication failed | Check API keys |
| HTTP 429 | Rate limit exceeded | Wait before retrying |
| HTTP 5xx | LiqPay server error | Retry after a short delay |

---

## Payment Status Values

| Status | Meaning |
|--------|---------|
| `success` | Payment completed successfully |
| `failure` | Payment failed |
| `error` | Processing error |
| `wait_accept` | Waiting for payer confirmation |
| `processing` | Being processed |
| `reversed` | Refunded or cancelled |
| `hold_wait` | Funds held, awaiting capture or cancel |
| `sandbox` | Test payment (sandbox mode) |
| `subscribed` | Subscription activated |
| `unsubscribed` | Subscription cancelled |
