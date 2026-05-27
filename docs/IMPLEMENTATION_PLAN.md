# LiqPay MCP Server — Implementation Plan

LiqPay is Ukraine's dominant payment gateway, operated by PrivatBank (the largest Ukrainian bank).
This MCP server exposes LiqPay's API to AI agents and LLM workflows.

**Market gap:** Zero MCP servers exist for LiqPay as of 2026-05-27.  
**Target audience:** Ukrainian e-commerce developers, diaspora businesses, fintech AI agents.

---

## Architecture

```
liqpay-mcp-server/
  src/
    index.ts            — McpServer entry point, tool registration, stdio transport, instructions
    auth.ts             — LiqPay signature: base64(SHA-1(private_key + data + private_key))
    client.ts           — HTTP client wrapping LiqPay v3 API endpoints
    types.ts            — TypeScript interfaces for LiqPay API request/response payloads
    constants.ts        — API URLs, CHARACTER_LIMIT, currency/status enums
    errors.ts           — Error handler mapping LiqPay error codes to actionable messages
    tools/
      payments.ts       — liqpay_create_checkout_url, liqpay_get_payment_status
      reports.ts        — liqpay_get_payments_list (by period, status, type)
      holds.ts          — liqpay_create_hold, liqpay_complete_hold, liqpay_cancel_hold
      refunds.ts        — liqpay_create_refund
      subscriptions.ts  — liqpay_create_subscription, liqpay_cancel_subscription
      payouts.ts        — liqpay_create_payout (P2P card transfer)
      webhooks.ts       — liqpay_verify_callback (signature validation utility)
  tests/
    auth.test.ts
    client.test.ts
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

**Server-to-server endpoint:** `https://www.liqpay.ua/api/request`  
**Checkout (redirect) endpoint:** `https://www.liqpay.ua/api/3/checkout`  
**Protocol:** POST with two fields: `data` (base64 JSON) + `signature` (base64 SHA-1)

### Authentication

```
data      = base64(JSON.stringify(payload))
signature = base64(SHA1(private_key + data + private_key))
```

- SHA-1 hash produces a raw binary digest, which is then base64-encoded.
- Every request payload must include `public_key` and `version: 3`.
- Both `public_key` and `private_key` are obtained from the liqpay.ua merchant dashboard.
- Node.js built-in `crypto.createHash('sha1')` is used — no external hash libraries needed.

**Env vars:**
```
LIQPAY_PUBLIC_KEY=your_public_key
LIQPAY_PRIVATE_KEY=your_private_key
```

### Common Payload Fields

Every LiqPay API request includes these fields in the `data` payload:

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Always `3` (current API version) |
| `public_key` | string | Merchant's public key |
| `action` | string | API action: `pay`, `hold`, `subscribe`, `refund`, `status`, `reports`, etc. |

---

## Tools — Full Specification

### Tool Naming Convention

All tools use the `liqpay_` prefix to avoid conflicts when used alongside other MCP servers (per MCP best practices). Names use `snake_case` with action-oriented verbs.

### Payments

#### `liqpay_create_checkout_url`

Generate a hosted checkout URL for a payment. Redirects the user to LiqPay's payment page.
Use when the agent needs to initiate a payment without handling card data directly.
Do not use for server-to-server card charges — use hold-based flow instead.
Returns a direct checkout URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Amount in currency units (e.g. `99.99`) |
| `currency` | string | ✓ | ISO 4217: `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Payment description shown to payer (max 500 chars) |
| `order_id` | string | ✓ | Unique order ID in your system |
| `result_url` | string | ✗ | Redirect URL after payment |
| `server_url` | string | ✗ | Webhook URL for payment notification |
| `language` | string | ✗ | `uk` or `en` (default: `uk`) |

**Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "checkout_url": { "type": "string", "description": "Direct link to LiqPay payment page" }
  },
  "required": ["checkout_url"]
}
```

**Implementation note:** This tool constructs the checkout URL locally by encoding the `data` and `signature` as query parameters — no server-to-server API call is made. The URL format is:
```
https://www.liqpay.ua/api/3/checkout?data={data}&signature={signature}
```

---

#### `liqpay_get_payment_status`

Fetch the current status of a payment by order ID (action: `status`).
Use when checking whether a payment succeeded, failed, or is still pending.
Returns full payment details including status, amounts, and timestamps.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Your order ID used when creating the payment |

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" },
    "payment_id": { "type": "number" },
    "amount": { "type": "number" },
    "currency": { "type": "string" },
    "description": { "type": "string" },
    "create_date": { "type": "number" },
    "end_date": { "type": "number" },
    "transaction_id": { "type": "number" }
  },
  "required": ["status", "payment_id", "amount", "currency"]
}
```

Possible statuses: `success`, `failure`, `error`, `wait_accept`, `processing`, `reversed`, `hold_wait`, `sandbox`.

---

### Reports

#### `liqpay_get_payments_list`

Retrieve a list of payments filtered by date range (action: `reports`).
Use when reviewing transaction history for a specific period.
Do not use for a single payment — use `liqpay_get_payment_status` instead.
Returns payment count and array of payment records.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | number | ✓ | Unix timestamp in ms (start of range) |
| `date_to` | number | ✓ | Unix timestamp in ms (end of range, max 31 days) |
| `status` | string | ✗ | Filter by status (e.g. `success`, `failure`, `reversed`) |

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "count": { "type": "number" },
    "data": { "type": "array", "items": { "type": "object" } }
  },
  "required": ["count", "data"]
}
```

---

### Holds (2-step payments)

> **⚠️ PCI DSS Warning:** `liqpay_create_hold` accepts raw card data. The merchant account must be PCI DSS Level 1 compliant to use this action. For most use cases, prefer `liqpay_create_checkout_url` which handles card data on LiqPay's side.

#### `liqpay_create_hold`

Pre-authorize (freeze) funds on the payer's card without capturing them (action: `hold`).
Use when you need a 2-step payment: reserve first, charge later.
Do not use if the merchant is not PCI DSS compliant — use `liqpay_create_checkout_url` instead.
Returns hold status and payment ID.

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

**Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "payment_id": { "type": "number" },
    "status": { "type": "string" },
    "amount": { "type": "number" },
    "currency": { "type": "string" }
  },
  "required": ["payment_id", "status", "amount", "currency"]
}
```

#### `liqpay_complete_hold`

Capture previously held funds — completes the 2-step payment (action: `hold_completion`).
Use after `liqpay_create_hold` to actually charge the frozen amount.
Returns capture status and payment ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Order ID from `liqpay_create_hold` |
| `amount` | number | ✗ | Partial capture amount (≤ held amount); omit for full capture |

**Annotations:** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" },
    "payment_id": { "type": "number" }
  },
  "required": ["status", "payment_id"]
}
```

#### `liqpay_cancel_hold`

Release held funds back to payer without capture (action: `hold_completion` with flag).
Use to cancel a previously created hold when the order is no longer needed.
Returns reversal status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Order ID from `liqpay_create_hold` |

**Annotations:** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" },
    "payment_id": { "type": "number" }
  },
  "required": ["status", "payment_id"]
}
```

---

### Refunds

#### `liqpay_create_refund`

Refund a completed payment — full or partial (action: `refund`).
Use when a customer requests a return or when a charge was made in error.
Returns refund status and the payment ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Order ID of the original payment |
| `amount` | number | ✗ | Amount to refund; omit for full refund |

**Annotations:** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "payment_id": { "type": "number" },
    "status": { "type": "string" },
    "amount": { "type": "number" }
  },
  "required": ["payment_id", "status"]
}
```

---

### Subscriptions (recurring)

#### `liqpay_create_subscription`

Create a recurring payment subscription via hosted checkout page (action: `subscribe`).
Use when setting up periodic charges (daily, weekly, monthly, yearly).
Returns a checkout URL for the subscriber to enter card details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Amount per billing cycle |
| `currency` | string | ✓ | `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Subscription description |
| `order_id` | string | ✓ | Unique subscription ID |
| `subscribe_date_start` | string | ✓ | First charge date `YYYY-MM-DD HH:mm:ss` |
| `subscribe_periodicity` | string | ✓ | `day`, `week`, `month`, `year` |
| `result_url` | string | ✗ | Redirect URL after subscription setup |
| `server_url` | string | ✗ | Webhook URL for recurring charge notifications |

**Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "checkout_url": { "type": "string" }
  },
  "required": ["checkout_url"]
}
```

#### `liqpay_cancel_subscription`

Cancel an active recurring subscription (action: `unsubscribe`).
Use when a subscriber wants to stop recurring charges.
Returns cancellation status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `order_id` | string | ✓ | Subscription order ID |

**Annotations:** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "status": { "type": "string" }
  },
  "required": ["status"]
}
```

---

### Payouts (P2P)

#### `liqpay_create_payout`

Send money directly to a card — P2P transfer (action: `p2p`).
Use when the merchant needs to pay out funds to a recipient's card.
Do not use without payout feature enabled on the merchant account.
Returns payout status and payment ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | ✓ | Payout amount |
| `currency` | string | ✓ | `UAH`, `USD`, `EUR` |
| `description` | string | ✓ | Purpose of payout |
| `order_id` | string | ✓ | Unique payout ID |
| `card` | string | ✓ | Recipient card number (16 digits) |

**Annotations:** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "payment_id": { "type": "number" },
    "status": { "type": "string" },
    "amount": { "type": "number" },
    "currency": { "type": "string" }
  },
  "required": ["payment_id", "status", "amount", "currency"]
}
```

---

### Webhooks

#### `liqpay_verify_callback`

Validate an incoming LiqPay webhook signature to confirm authenticity.
Use when processing a callback from LiqPay to verify it was not tampered with.
Do not use for outgoing requests — signature is built automatically by the client.
Returns validation result and decoded payment data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | ✓ | Raw `data` field from webhook POST body |
| `signature` | string | ✓ | Raw `signature` field from webhook POST body |

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

**outputSchema:**
```json
{
  "type": "object",
  "properties": {
    "valid": { "type": "boolean" },
    "decoded_data": { "type": "object" }
  },
  "required": ["valid"]
}
```

---

## Implementation Phases

### Phase 1 — Foundation (day 1)

- [ ] `package.json` — scoped or unscoped `liqpay-mcp-server`, version `1.0.0`, ESM (`"type": "module"`), `prepublishOnly: "npm run build"`, `bin` entry for npx
- [ ] `tsconfig.json` — `target: "ES2022"`, `module: "Node16"`, `moduleResolution: "Node16"`, `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] `src/constants.ts` — API URLs, `CHARACTER_LIMIT = 25000`, currency enum, status enum
- [ ] `src/types.ts` — TypeScript interfaces for LiqPay payloads and responses
- [ ] `src/auth.ts` — SHA-1 signature using Node.js built-in `crypto.createHash('sha1')`
- [ ] `src/client.ts` — typed HTTP client using `fetch` (Node 18+), posts `data` + `signature` to `/api/request`
- [ ] `src/errors.ts` — error handler mapping LiqPay error responses to actionable messages
- [ ] `src/index.ts` — McpServer with `name`, `version`, `instructions` field; stdio transport; tool registration
- [ ] `tests/auth.test.ts` — verify signature against known LiqPay SDK test vectors
- [ ] `tests/client.test.ts` — mock HTTP, verify request encoding

### Phase 2 — Core tools (day 1–2)

- [ ] `src/tools/payments.ts` — `liqpay_create_checkout_url`, `liqpay_get_payment_status`
- [ ] `src/tools/reports.ts` — `liqpay_get_payments_list`
- [ ] `src/tools/refunds.ts` — `liqpay_create_refund`
- [ ] `src/tools/webhooks.ts` — `liqpay_verify_callback`
- [ ] Tests for all Phase 2 tools (vitest, mock HTTP responses)
- [ ] Every tool: `title`, `description` (TDQS), `inputSchema` (Zod), `outputSchema` (Zod), `annotations`
- [ ] Every tool response: both `content` (text) and `structuredContent` (typed JSON)

### Phase 3 — Advanced tools (day 2)

- [ ] `src/tools/holds.ts` — `liqpay_create_hold`, `liqpay_complete_hold`, `liqpay_cancel_hold`
- [ ] `src/tools/subscriptions.ts` — `liqpay_create_subscription`, `liqpay_cancel_subscription`
- [ ] `src/tools/payouts.ts` — `liqpay_create_payout`
- [ ] Tests for all Phase 3 tools
- [ ] End-to-end test: checkout URL → verify_callback round-trip (mocked)

### Phase 4 — Polish & publish (day 3)

- [ ] `README.md` — badges, VS Code one-click install button, Claude Desktop JSON config block, tools table with annotations
- [ ] `LICENSE` — MIT
- [ ] `CHANGELOG.md` — initial entry
- [ ] `.github/workflows/ci.yml` — Node 20 + 22 matrix, `npm ci && npm run build && npm test`
- [ ] `.env.example` — with commented descriptions
- [ ] `npm run build` — 0 errors, 0 warnings
- [ ] All tests green
- [ ] Test with MCP Inspector: `npx @modelcontextprotocol/inspector`
- [ ] `npm publish --access public`
- [ ] `git tag v1.0.0 && git push origin v1.0.0`
- [ ] `gh release create v1.0.0`
- [ ] Submit to Glama, mcp.so, smithery.ai

---

## McpServer Configuration

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "liqpay-mcp-server",
  version: "1.0.0",
  instructions: `LiqPay payment gateway integration for Ukrainian e-commerce.
Supports payments, holds, refunds, subscriptions, payouts, and webhook verification.
Requires LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY environment variables.
All monetary amounts are in currency minor units (e.g. 99.99 for ₴99.99).
Use liqpay_create_checkout_url for PCI-safe payments via hosted page.
Use liqpay_get_payment_status to check payment results.
Use liqpay_verify_callback to validate incoming webhooks.`
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Tool Registration Pattern

Every tool follows this pattern with `registerTool`:

```typescript
import { z } from "zod";

const CreateCheckoutInputSchema = {
  amount: z.number().positive().describe("Payment amount in currency units (e.g. 99.99 for ₴99.99)"),
  currency: z.enum(["UAH", "USD", "EUR"]).describe("ISO 4217 currency code"),
  description: z.string().min(1).max(500).describe("Payment description shown to payer"),
  order_id: z.string().min(1).describe("Unique order ID in your system (e.g. 'order-2026-001')"),
  result_url: z.string().url().optional().describe("Redirect URL after payment completion"),
  server_url: z.string().url().optional().describe("Webhook URL for server-to-server notification"),
  language: z.enum(["uk", "en"]).default("uk").describe("Payment page language")
};

const CreateCheckoutOutputSchema = {
  checkout_url: z.string().url().describe("Direct link to LiqPay hosted payment page")
};

server.registerTool(
  "liqpay_create_checkout_url",
  {
    title: "Create LiqPay Checkout URL",
    description: `Generate a hosted checkout URL for a LiqPay payment (PCI DSS safe).
Use when initiating a payment without handling card data directly.
Do not use for server-to-server card charges — use liqpay_create_hold instead.
Returns { checkout_url: string }.`,
    inputSchema: CreateCheckoutInputSchema,
    outputSchema: CreateCheckoutOutputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ amount, currency, description, order_id, result_url, server_url, language }) => {
    const checkoutUrl = buildCheckoutUrl({
      action: "pay",
      amount,
      currency,
      description,
      order_id,
      result_url,
      server_url,
      language
    });

    const output = { checkout_url: checkoutUrl };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output
    };
  }
);
```

---

## Quality Standards

### Tool Description Quality Standard (TDQS)

Every tool description follows this 4-line template:

```
"<What it does> (<key constraints>).
Use when <when to use>.
Do not use if <when not to use — name alternative>.
Returns <what it returns>."
```

### Zod Schema Rules

Every parameter must have `.describe()` with a format example:

```typescript
// ✅ Good
amount: z.number().positive().describe("Payment amount in currency units (e.g. 99.99 for ₴99.99)")
order_id: z.string().min(1).describe("Unique order ID in your system (e.g. 'order-2026-001')")
currency: z.enum(["UAH", "USD", "EUR"]).describe("ISO 4217 currency code")

// ❌ Bad
amount: z.number()
order_id: z.string()
```

### MCP SDK Rules

- `server.registerTool()` — not deprecated `server.tool()`
- `title` on every tool — human-readable display name
- `description` on every tool — TDQS format
- `inputSchema` — raw Zod shape (object of Zod types, not wrapped in `z.object()`)
- `outputSchema` — raw Zod shape defining structured output
- `annotations` on every tool (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- Every response includes both `content` (text for backwards compatibility) and `structuredContent` (typed JSON)
- No `console.log()` in stdio mode — use `console.error()` for debug logging
- Validate env vars on startup — fail fast with actionable error if missing

### Error Handling

```typescript
// Tool execution errors use isError: true, not thrown exceptions
return {
  content: [{
    type: "text",
    text: "Error: Order 'abc-123' not found. Verify the order_id matches the one used at payment creation."
  }],
  isError: true
};
```

Error messages must be:
- **Actionable**: tell the agent what to do next
- **Specific**: include the actual values that caused the error
- **Safe**: never expose private keys, internal stack traces, or raw LiqPay error internals

---

## Auth Module Implementation

```typescript
// src/auth.ts — uses Node.js built-in crypto, no external dependencies
import { createHash } from "node:crypto";

export function createSignature(data: string, privateKey: string): string {
  const hash = createHash("sha1")
    .update(privateKey + data + privateKey)
    .digest("base64");
  return hash;
}

export function encodeData(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeData(data: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
}
```

---

## Key Dependencies

```json
{
  "name": "liqpay-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for LiqPay payment gateway — payments, holds, refunds, subscriptions, payouts",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "liqpay-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "@types/node": "^22.10.0"
  }
}
```

**Key design choice:** No `js-sha3` — LiqPay uses SHA-1 (verified against official liqpay/sdk-nodejs), which is available via Node.js built-in `crypto`. No `axios` — Node 18+ has native `fetch`.

---

## Target Metrics

| Metric | Target |
|--------|--------|
| Tools | 11 tools |
| Tests | ≥ 55 (5/tool) |
| Glama Quality | A tier (≥ 3.5) |
| npm downloads (week 1) | 50+ |
| GitHub stars (month 1) | 20+ |
