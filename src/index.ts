#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LiqPayClient } from "./client.js";

const publicKey = process.env["LIQPAY_PUBLIC_KEY"];
const privateKey = process.env["LIQPAY_PRIVATE_KEY"];

if (!publicKey || !privateKey) {
  console.error(
    "Error: LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY environment variables are required.\n" +
      "Get your keys at https://www.liqpay.ua/en/adminbusiness",
  );
  process.exit(1);
}

const client = new LiqPayClient(publicKey, privateKey);

const server = new McpServer(
  {
    name: "liqpay-mcp-server",
    version: "1.0.0",
  },
  {
    instructions:
      "LiqPay payment gateway integration for Ukrainian e-commerce. " +
      "Supports payments, holds, refunds, subscriptions, payouts, and webhook verification. " +
      "Requires LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY environment variables. " +
      "All monetary amounts are in currency units (e.g. 99.99 for ₴99.99). " +
      "Use liqpay_create_checkout_url for PCI-safe payments via hosted page. " +
      "Use liqpay_get_payment_status to check payment results. " +
      "Use liqpay_verify_callback to validate incoming webhooks.",
  },
);

// Tool registration will be added in Phase 2 & 3.
// Each tool file in src/tools/ exports a register function that takes (server, client).
void client;

const transport = new StdioServerTransport();
await server.connect(transport);
