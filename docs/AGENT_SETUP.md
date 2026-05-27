# Agent Setup Guide

Instructions for AI agents to automatically install and configure liqpay-mcp-server.

## Prerequisites

- Node.js >= 18
- LiqPay merchant account with public and private keys
  - Keys are available at https://www.liqpay.ua/en/adminbusiness
  - If the user does not have an account, direct them to https://www.liqpay.ua/en/registration

## Installation

Run without installing (recommended):

```bash
npx -y liqpay-mcp-server
```

Or install globally:

```bash
npm install -g liqpay-mcp-server
```

## Configuration

### Claude Desktop (macOS)

Config file path: `~/Library/Application Support/Claude/claude_desktop_config.json`

Read the existing config, merge this into the `mcpServers` object, and write it back:

```json
{
  "mcpServers": {
    "liqpay": {
      "command": "npx",
      "args": ["-y", "liqpay-mcp-server"],
      "env": {
        "LIQPAY_PUBLIC_KEY": "<ask user for public key>",
        "LIQPAY_PRIVATE_KEY": "<ask user for private key>"
      }
    }
  }
}
```

### Claude Desktop (Windows)

Config file path: `%APPDATA%\Claude\claude_desktop_config.json`

Same JSON content as macOS.

### Claude Code (CLI)

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "liqpay": {
      "command": "npx",
      "args": ["-y", "liqpay-mcp-server"],
      "env": {
        "LIQPAY_PUBLIC_KEY": "<ask user for public key>",
        "LIQPAY_PRIVATE_KEY": "<ask user for private key>"
      }
    }
  }
}
```

### Cursor / VS Code

Add to `.cursor/mcp.json` or `.vscode/mcp.json` in the project root:

```json
{
  "servers": {
    "liqpay": {
      "command": "npx",
      "args": ["-y", "liqpay-mcp-server"],
      "env": {
        "LIQPAY_PUBLIC_KEY": "<ask user for public key>",
        "LIQPAY_PRIVATE_KEY": "<ask user for private key>"
      }
    }
  }
}
```

## Setup Steps for an Agent

1. **Ask the user for their LiqPay keys.** Tell them:
   > "Go to https://www.liqpay.ua/en/adminbusiness, log in, and copy your Public Key and Private Key. Paste them here."

2. **Check if Node.js is available:**
   ```bash
   node --version
   ```
   If not installed, direct the user to https://nodejs.org/ (LTS version).

3. **Verify the package is accessible:**
   ```bash
   npx -y liqpay-mcp-server --help 2>&1 || echo "Package not reachable"
   ```

4. **Detect the MCP client** and locate its config file:
   - Claude Desktop macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Claude Desktop Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Claude Code: `~/.claude/settings.json` (global) or `.claude/settings.json` (project)
   - Cursor: `.cursor/mcp.json`
   - VS Code: `.vscode/mcp.json`

5. **Read the existing config**, merge the liqpay server entry, and write it back. Do not overwrite other MCP servers already in the config.

6. **Tell the user to restart** their MCP client for the changes to take effect.

7. **Verify** by calling `liqpay_create_checkout_url` with test values — this tool builds the URL locally and confirms the server is running without making any real API call.

## Key Troubleshooting

| Problem | Solution |
|---------|----------|
| `Error: LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY ... are required` | Environment variables not set — check config file path and restart client |
| `Error [err_auth]: ...` | Keys are invalid — user should re-copy them from the LiqPay dashboard |
| `Error [err_signature]: ...` | Private key mismatch — ensure no extra spaces when copying the key |
| `Error [err_shop_not_active]: ...` | Merchant account is not yet activated — user needs to complete LiqPay onboarding |
| `Error: LiqPay server error (HTTP 5xx)` | LiqPay API is temporarily unavailable — retry after a short delay |

## Verifying the Setup

After configuration, run these tools in order:

1. `liqpay_create_checkout_url` with `amount: 1`, `currency: "UAH"`, `description: "test"`, `order_id: "test-001"` — no API call, confirms server is running
2. `liqpay_get_payment_status` with a known `order_id` — confirms API keys are valid
3. `liqpay_verify_callback` with dummy `data` and `signature` — confirms webhook verification works

If step 1 succeeds, the server is running. If step 2 succeeds, the API keys are correct and the merchant account is active.

## Sandbox Testing

To test without real money, see [SANDBOX_TESTING.md](./SANDBOX_TESTING.md).
