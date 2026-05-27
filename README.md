<p align="center">
  <img src="https://www.liqpay.ua/logo_liqpay.svg" alt="LiqPay" width="200" />
</p>

<h1 align="center">liqpay-mcp-server</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/liqpay-mcp-server"><img src="https://img.shields.io/npm/v/liqpay-mcp-server" alt="npm version" /></a>
  <a href="https://github.com/serhiizghama/liqpay-mcp/actions/workflows/ci.yml"><img src="https://github.com/serhiizghama/liqpay-mcp/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/liqpay-mcp-server" alt="Node version" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-blue" alt="MCP compatible" /></a>
  <a href="https://github.com/serhiizghama/liqpay-mcp"><img src="https://img.shields.io/github/stars/serhiizghama/liqpay-mcp?style=social" alt="GitHub stars" /></a>
</p>

MCP server for the [LiqPay](https://www.liqpay.ua/) payment gateway — Ukraine's dominant payment platform operated by PrivatBank.

Exposes 11 tools for payments, holds, refunds, subscriptions, payouts, and webhook verification to AI agents and LLM workflows via the [Model Context Protocol](https://modelcontextprotocol.io/).

## Features

- **11 tools** covering the full LiqPay API: payments, holds, refunds, subscriptions, P2P payouts, webhooks
- **PCI DSS safe** — hosted checkout keeps card data on LiqPay's side
- **2-step hold flow** — freeze funds first, capture or cancel later
- **Recurring subscriptions** — daily, weekly, monthly, yearly billing cycles
- **Webhook verification** — SHA-1 signature validation for incoming callbacks
- **Truncation protection** — large report responses are automatically truncated with guidance
- **TypeScript** — full type safety, strict mode, zero `any`
- **Zero extra dependencies** — uses Node.js built-in `crypto` and native `fetch`

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "liqpay": {
      "command": "npx",
      "args": ["-y", "liqpay-mcp-server"],
      "env": {
        "LIQPAY_PUBLIC_KEY": "your_public_key",
        "LIQPAY_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

### VS Code / Cursor

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0078d4?logo=visualstudiocode)](https://insiders.vscode.dev/redirect/mcp/install?name=liqpay&inputs=%5B%7B%22id%22%3A%22publicKey%22%2C%22description%22%3A%22LiqPay%20Public%20Key%22%2C%22type%22%3A%22promptString%22%7D%2C%7B%22id%22%3A%22privateKey%22%2C%22description%22%3A%22LiqPay%20Private%20Key%22%2C%22type%22%3A%22promptString%22%2C%22password%22%3Atrue%7D%5D&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22liqpay-mcp-server%22%5D%2C%22env%22%3A%7B%22LIQPAY_PUBLIC_KEY%22%3A%22%24%7Binput%3ApublicKey%7D%22%2C%22LIQPAY_PRIVATE_KEY%22%3A%22%24%7Binput%3AprivateKey%7D%22%7D%7D)

Or add to `.vscode/mcp.json` / `.cursor/mcp.json` manually:

```json
{
  "servers": {
    "liqpay": {
      "command": "npx",
      "args": ["-y", "liqpay-mcp-server"],
      "env": {
        "LIQPAY_PUBLIC_KEY": "your_public_key",
        "LIQPAY_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

### Claude Code (CLI)

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "liqpay": {
      "command": "npx",
      "args": ["-y", "liqpay-mcp-server"],
      "env": {
        "LIQPAY_PUBLIC_KEY": "your_public_key",
        "LIQPAY_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

## Prerequisites

- Node.js >= 18
- LiqPay merchant account — get your keys at [liqpay.ua/en/adminbusiness](https://www.liqpay.ua/en/adminbusiness)

## Tools

| Tool | Description | Annotations |
|------|-------------|-------------|
| `liqpay_create_checkout_url` | Generate a hosted checkout URL (PCI DSS safe) | `idempotent` `open-world` |
| `liqpay_get_payment_status` | Fetch payment status by order ID | `read-only` `idempotent` `open-world` |
| `liqpay_get_payments_list` | List payments by date range (max 31 days) | `read-only` `idempotent` `open-world` |
| `liqpay_create_hold` | Pre-authorize funds on a card (2-step) | `open-world` |
| `liqpay_complete_hold` | Capture previously held funds | `destructive` `open-world` |
| `liqpay_cancel_hold` | Release held funds back to payer | `destructive` `idempotent` `open-world` |
| `liqpay_create_refund` | Refund a completed payment (full/partial) | `destructive` `open-world` |
| `liqpay_create_subscription` | Create recurring subscription via checkout | `idempotent` `open-world` |
| `liqpay_cancel_subscription` | Cancel an active subscription | `destructive` `idempotent` `open-world` |
| `liqpay_create_payout` | P2P transfer to a card | `destructive` `open-world` |
| `liqpay_verify_callback` | Validate incoming webhook signature | `read-only` `idempotent` |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LIQPAY_PUBLIC_KEY` | Yes | Merchant public key from LiqPay dashboard |
| `LIQPAY_PRIVATE_KEY` | Yes | Merchant private key from LiqPay dashboard |

## Rate Limits

| Scope | Limit |
|-------|-------|
| All API requests | ~100 req/min per merchant account |
| Reports (`liqpay_get_payments_list`) | Max 31-day date range per request |
| Checkout URL generation | No limit — computed locally, no API call |
| Webhook verification | No limit — computed locally, no API call |

## Docker

```bash
docker build -t liqpay-mcp-server .
docker run -e LIQPAY_PUBLIC_KEY=your_key -e LIQPAY_PRIVATE_KEY=your_secret liqpay-mcp-server
```

Or with docker-compose:

```yaml
services:
  liqpay-mcp:
    build: .
    environment:
      LIQPAY_PUBLIC_KEY: your_key
      LIQPAY_PRIVATE_KEY: your_secret
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (auto-reload)
npm run dev

# Build
npm run build

# Run tests
npm test

# Test with MCP Inspector
LIQPAY_PUBLIC_KEY=test LIQPAY_PRIVATE_KEY=test \
  npx @modelcontextprotocol/inspector node dist/index.js
```

See [docs/SANDBOX_TESTING.md](./docs/SANDBOX_TESTING.md) for testing without real money.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/AGENT_SETUP.md](./docs/AGENT_SETUP.md) | Instructions for AI agents to install and configure this server |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Complete tool reference with request/response examples |
| [docs/SANDBOX_TESTING.md](./docs/SANDBOX_TESTING.md) | How to test with LiqPay sandbox (no real money) |

## Security

- LiqPay API signature uses SHA-1: `base64(sha1(private_key + data + private_key))`
- Private keys are never logged or included in tool responses
- `liqpay_create_hold` and `liqpay_create_payout` accept raw card numbers — ensure PCI DSS compliance
- For most payment use cases, prefer `liqpay_create_checkout_url` which handles card data on LiqPay's side

## License

[MIT](./LICENSE)
