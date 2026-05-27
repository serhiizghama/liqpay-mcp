# Sandbox Testing

How to test liqpay-mcp-server without real money.

## LiqPay Sandbox

LiqPay provides a sandbox environment where payments are simulated — no real charges occur. To use it:

1. Register at https://www.liqpay.ua/en/registration
2. Log in to https://www.liqpay.ua/en/adminbusiness
3. Copy your **Public Key** and **Private Key** from the dashboard
4. Use these keys with the server — all payments in sandbox mode are simulated automatically when the key pair belongs to a test account

> Test accounts are identified by LiqPay based on the key. If your account is in test/sandbox mode, the payment response will have `"status": "sandbox"`.

---

## Tools That Work Without API Keys

Two tools perform no HTTP requests — they work with any keys, including dummy values:

### `liqpay_create_checkout_url`

Generates the URL locally using SHA-1 + base64. Safe to call with test keys:

```bash
LIQPAY_PUBLIC_KEY=test_pub LIQPAY_PRIVATE_KEY=test_priv \
  npx @modelcontextprotocol/inspector node dist/index.js
```

Call with:
```json
{
  "amount": 100,
  "currency": "UAH",
  "description": "Test payment",
  "order_id": "test-001"
}
```

Expected: returns a URL starting with `https://www.liqpay.ua/api/3/checkout?data=...`

### `liqpay_verify_callback`

Verifies webhook signatures locally. You can generate a valid test pair:

```typescript
import { encodeData, createSignature } from "./src/auth.js";

const privateKey = "test_priv";
const payload = { status: "success", payment_id: 1, amount: 100, order_id: "test-001" };
const data = encodeData(payload);
const signature = createSignature(data, privateKey);

// Use data + signature in liqpay_verify_callback
```

---

## Test Card Numbers

When testing `liqpay_create_hold` or direct card payments, LiqPay accepts these test cards:

| Card Number | Expected Result |
|-------------|-----------------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Failure |
| Any expiry `MM/YY` in the future, CVV `123` | Valid |

> These cards only work in sandbox mode. Using them with a production key will fail.

---

## Testing with MCP Inspector

Build first, then launch the Inspector:

```bash
npm run build
LIQPAY_PUBLIC_KEY=your_sandbox_pub LIQPAY_PRIVATE_KEY=your_sandbox_priv \
  npx @modelcontextprotocol/inspector node dist/index.js
```

Open http://localhost:5173 in your browser. You can invoke all 11 tools interactively.

**Recommended test sequence:**

1. `liqpay_create_checkout_url` — verify server starts and URL is generated
2. `liqpay_get_payment_status` with `order_id: "nonexistent"` — verify error handling (`err_order_id`)
3. `liqpay_verify_callback` with mismatched signature — verify `valid: false` is returned
4. `liqpay_get_payments_list` with a date range — verify reports endpoint works

---

## Running the Test Suite

The test suite uses mocked HTTP responses — no real API calls, no keys needed:

```bash
npm test
```

All 80 tests should pass. Tests cover:

- Auth module: SHA-1 signature, base64 encoding/decoding
- HTTP client: request encoding, error handling
- All 11 tools: success paths, error paths, edge cases
- E2E round-trip: `liqpay_create_checkout_url` → `liqpay_verify_callback`
