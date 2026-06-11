# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

Please **do not** report security issues through public GitHub issues.

Instead, use one of the following channels:

- **GitHub private vulnerability reporting** (preferred): [Report a vulnerability](https://github.com/serhiizghama/liqpay-mcp/security/advisories/new)
- **Email**: zmrser@gmail.com with the subject line `[SECURITY] liqpay-mcp`

Please include a description of the issue, steps to reproduce, and the affected version. You can expect an initial response within 72 hours.

## Credential Handling

This MCP server moves real money (payments, refunds, payouts), so credential safety is the top priority:

- The LiqPay key pair is read from the `LIQPAY_PUBLIC_KEY` and `LIQPAY_PRIVATE_KEY` environment variables at startup and is never written to disk.
- Requests are sent exclusively to `https://www.liqpay.ua` over HTTPS — there are no third-party endpoints.
- The private key is used only to sign request payloads locally; it is not logged and never included in MCP tool responses.

If you find any behavior that contradicts the above, please report it as a vulnerability.

## Out of Scope

- Vulnerabilities in the LiqPay API itself — report those to [LiqPay / PrivatBank](https://www.liqpay.ua/).
- Issues that require a compromised local environment (e.g. an attacker who can already read your process environment).
