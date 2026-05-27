# LiqPay MCP — Implementation Plan

LiqPay is Ukraine's dominant payment gateway, operated by PrivatBank (the largest Ukrainian bank).
This MCP server exposes LiqPay's API to AI agents and LLM workflows.

**Market gap:** Zero MCP servers exist for LiqPay as of 2026-05-27.  
**Target audience:** Ukrainian e-commerce developers, diaspora businesses, fintech AI agents.

---

## Architecture

```
liqpay-mcp/
  src/
    index.ts            — McpServer entry point, tool registration, stdio transport
    auth.ts             — LiqPay signature: SHA3-256(private+data+private), base64
    client.ts           — HTTP client wrapping LiqPay v3 API endpoint
    tools/
      payments.ts       — create_payment, get_payment_status, create_checkout_url
      holds.ts          — create_hold, complete_hold, cancel_hold
      refunds.ts        — create_refund, get_refund_status
      subscriptions.ts  — create_subscription, cancel_subscription, get_subscription
      payouts.ts        — create_payout (P2P card transfer)
      reports.ts        — get_payments_list (by period, status, type)
      webhooks.ts       — verify_callback (signature validation utility)
  tests/
    auth.test.ts
    payments.test.ts
    holds.test.ts
    refunds.test.ts
    subscriptions.test.ts
    payouts.test.ts
    reports.test.ts
    webhooks.test.ts
  docs/
    IMPLEMENTATION_PLAN.md  — this file
  .github/
    workflows/
      ci.yml            — Node 20 & 22 matrix, npm ci + build + test
  .env.example
  package.json
  tsconfig.json
  LICENSE               — MIT
  README.md
  CHANGELOG.md
```

---

## LiqPay API Overview

**Base URL:** `https://www.liqpay.ua/api/`  
**Protocol:** POST with `data` (base64 JSON) + `signature` (base64 SHA3-256)

### Authentication

```
data      = base64(JSON.stringify(payload))
signature = base64(SHA3_256(private_key + data + private_key))
```

Both `public_key` and `private_key` are required (obtained from liqpay.ua merchant dashboard).

**Env vars:**
```
LIQPAY_PUBLIC_KEY=your_public_key
LIQPAY_PRIVATE_KEY=your_private_key
```

---

## Tools — Full Specification

### Payments

#### `create_checkout_url`
Generate a hosted checkout URL for a payment. Redirects the user to LiqPay's payment page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Amount in currency units (e.g. `99.99`) |
| `currency` | string | ✓ | ISO 4217: `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Payment description shown to payer (max 500 chars) |
| `order_id` | string | ✓ | Unique order ID in your system |
| `result_url` | string | ✗ | Redirect URL after payment |
| `server_url` | string | ✗ | Webhook URL for payment notification |
| `language` | string | ✗ | `uk` or `en` (default: `uk`) |

Returns: `{ checkout_url: string }` — direct link to LiqPay payment page.

---

#### `get_payment_status`
Fetch the current status of a payment by order ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Your order ID used when creating the payment |

Returns: `{ status, payment_id, amount, currency, description, create_date, end_date, transaction_id }`

Possible statuses: `success`, `failure`, `error`, `wait_accept`, `processing`, `reversed`, `hold_wait`.

---

#### `get_payments_list`
Retrieve a paginated list of payments filtered by date range.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | number | ✓ | Unix timestamp in ms (start of range) |
| `date_to` | number | ✓ | Unix timestamp in ms (end of range, max range 31 days) |
| `status` | string | ✗ | Filter by status (e.g. `success`) |

Returns: `{ count, data: Payment[] }`

---

### Holds (2-step payments)

#### `create_hold`
Pre-authorize (freeze) funds on the payer's card without capturing them.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Amount to hold |
| `currency` | string | ✓ | `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Description for the payer |
| `order_id` | string | ✓ | Unique order ID |
| `card` | string | ✓ | Payer's card number (16 digits) |
| `card_exp_month` | string | ✓ | Expiry month `MM` |
| `card_exp_year` | string | ✓ | Expiry year `YY` |
| `card_cvv` | string | ✓ | CVV code |

Returns: `{ payment_id, status: "hold_wait", amount, currency }`

#### `complete_hold`
Capture previously held funds (completes the 2-step payment).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Order ID from `create_hold` |
| `amount` | number | ✗ | Partial capture amount (≤ held amount) |

Returns: `{ status: "success" \| "error", payment_id }`

#### `cancel_hold`
Release held funds back to payer without capture.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Order ID from `create_hold` |

Returns: `{ status: "reversed", payment_id }`

---

### Refunds

#### `create_refund`
Refund a completed payment (full or partial).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Order ID of the original payment |
| `amount` | number | ✗ | Amount to refund; omit for full refund |

Returns: `{ payment_id, status: "reversed" \| "processing", amount }`

---

### Subscriptions (recurring)

#### `create_subscription`
Create a recurring payment subscription charged on a set interval.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Amount per billing cycle |
| `currency` | string | ✓ | `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Subscription description |
| `order_id` | string | ✓ | Unique subscription ID |
| `subscribe_date_start` | string | ✓ | First charge date `YYYY-MM-DD HH:mm:ss` |
| `subscribe_periodicity` | string | ✓ | `day`, `week`, `month`, `year` |

Returns: `{ subscription_id, status, next_charge_date }`

#### `cancel_subscription`
Cancel an active recurring subscription.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Subscription order ID |

Returns: `{ status: "unsubscribed" \| "error" }`

---

### Payouts (P2P)

#### `create_payout`
Send money directly to a card (P2P transfer). Requires payout feature enabled on merchant account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Payout amount |
| `currency` | string | ✓ | `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Purpose of payout |
| `order_id` | string | ✓ | Unique payout ID |
| `card` | string | ✓ | Recipient card number (16 digits) |

Returns: `{ payment_id, status, amount, currency }`

---

### Webhooks

#### `verify_callback`
Validate an incoming LiqPay webhook signature to confirm authenticity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | ✓ | Raw `data` field from webhook POST body |
| `signature` | string | ✓ | Raw `signature` field from webhook POST body |

Returns: `{ valid: boolean, decoded_data: object }` — also returns the decoded payment data if valid.

---

## Implementation Phases

### Phase 1 — Foundation (day 1)
- [ ] `package.json` — unscoped `liqpay-mcp`, version `1.0.0`, ESM, `prepublishOnly`
- [ ] `tsconfig.json` — `NodeNext` module, strict, `noUncheckedIndexedAccess`
- [ ] `src/auth.ts` — SHA3-256 signature using `js-sha3`
- [ ] `src/client.ts` — fetch wrapper, typed request/response
- [ ] `src/index.ts` — McpServer skeleton, stdio transport, `instructions` field

### Phase 2 — Core tools (day 1–2)
- [ ] `src/tools/payments.ts` — `create_checkout_url`, `get_payment_status`, `get_payments_list`
- [ ] `src/tools/refunds.ts` — `create_refund`
- [ ] `src/tools/webhooks.ts` — `verify_callback`
- [ ] Tests for all Phase 2 tools (vitest, mock HTTP)

### Phase 3 — Advanced tools (day 2)
- [ ] `src/tools/holds.ts` — `create_hold`, `complete_hold`, `cancel_hold`
- [ ] `src/tools/subscriptions.ts` — `create_subscription`, `cancel_subscription`
- [ ] `src/tools/payouts.ts` — `create_payout`
- [ ] Tests for all Phase 3 tools

### Phase 4 — Polish & publish (day 3)
- [ ] `README.md` — badges, VS Code one-click button, Claude Desktop config block, tools table
- [ ] `LICENSE` MIT
- [ ] `CHANGELOG.md` — initial entry
- [ ] `.github/workflows/ci.yml` — Node 20+22 matrix
- [ ] `.env.example`
- [ ] `npm run build` — 0 errors
- [ ] All tests green
- [ ] `npm publish --access public`
- [ ] `git tag v1.0.0 && git push origin v1.0.0`
- [ ] `gh release create v1.0.0`
- [ ] Submit to Glama, mcp.so, smithery.ai

---

## Quality Standards

All tools must follow TDQS (Tool Description Quality Standard):

```
"<What it does> (<key constraints>).
Use when <when to use>.
Do not use if <when not to use — name alternative>.
Returns <what it returns>."
```

Every Zod parameter must have `.describe()` with format example:
```typescript
// ✅
amount: z.number().positive().describe("Payment amount in currency units (e.g. 99.99 for ₴99.99)")
// ❌
amount: z.number()
```

MCP SDK rules:
- `server.registerTool()` — not deprecated `server.tool()`  
- `annotations` on every tool (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- No `console.log()` in stdio mode — use `console.error()` for debug
- `inputSchema`: raw Zod shape, not `z.object()`

---

## Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "zod": "^3.x",
    "js-sha3": "^0.9.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^2.x",
    "@types/node": "^22.x"
  }
}
```

`js-sha3` — for SHA3-256 (not SHA-256; LiqPay specifically uses SHA3).

---

## Target Metrics

| Metric | Target |
|--------|--------|
| Tools | 12 tools |
| Tests | ≥ 60 (5/tool) |
| Glama Quality | A tier (≥ 3.5) |
| npm downloads (week 1) | 50+ |
| GitHub stars (month 1) | 20+ |
