import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerPaymentTools } from "../src/tools/payments.js";
import { registerWebhookTools } from "../src/tools/webhooks.js";
import { createSignature, encodeData } from "../src/auth.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerPaymentTools(server, client);
  registerWebhookTools(server, PRIVATE_KEY);
  return server;
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<any> {
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool ${name} not registered`);
  return tool.handler(args, {} as any);
}

describe("E2E: checkout → callback verification", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("checkout URL data can be verified by verify_callback", async () => {
    // Step 1: Create a checkout URL
    const checkoutResult = await callTool(server, "liqpay_create_checkout_url", {
      amount: 150,
      currency: "UAH",
      description: "E2E test order",
      order_id: "e2e-001",
      language: "uk",
    });

    const checkoutUrl = checkoutResult.structuredContent.checkout_url as string;
    const url = new URL(checkoutUrl);
    const data = url.searchParams.get("data")!;
    const signature = url.searchParams.get("signature")!;

    // Step 2: Verify the signature using verify_callback
    const verifyResult = await callTool(server, "liqpay_verify_callback", { data, signature });

    expect(verifyResult.structuredContent.valid).toBe(true);
    expect(verifyResult.structuredContent.decoded_data.action).toBe("pay");
    expect(verifyResult.structuredContent.decoded_data.amount).toBe(150);
    expect(verifyResult.structuredContent.decoded_data.currency).toBe("UAH");
    expect(verifyResult.structuredContent.decoded_data.order_id).toBe("e2e-001");
  });

  it("tampered data fails verification", async () => {
    // Create a valid checkout URL
    const checkoutResult = await callTool(server, "liqpay_create_checkout_url", {
      amount: 100,
      currency: "USD",
      description: "Tamper test",
      order_id: "e2e-tamper",
      language: "en",
    });

    const checkoutUrl = checkoutResult.structuredContent.checkout_url as string;
    const url = new URL(checkoutUrl);
    const originalSignature = url.searchParams.get("signature")!;

    // Tamper with the data (different payload, same signature)
    const tamperedData = encodeData({ action: "pay", amount: 999, currency: "USD", description: "Hacked", order_id: "e2e-tamper" });

    const verifyResult = await callTool(server, "liqpay_verify_callback", { data: tamperedData, signature: originalSignature });

    expect(verifyResult.structuredContent.valid).toBe(false);
  });

  it("simulated LiqPay callback verifies correctly", async () => {
    // Simulate what LiqPay would send back as a webhook callback
    const callbackPayload = {
      status: "success",
      payment_id: 12345,
      amount: 250,
      currency: "UAH",
      order_id: "e2e-callback",
      description: "Webhook test",
      public_key: PUBLIC_KEY,
      version: 3,
    };

    const data = encodeData(callbackPayload);
    const signature = createSignature(data, PRIVATE_KEY);

    const result = await callTool(server, "liqpay_verify_callback", { data, signature });

    expect(result.structuredContent.valid).toBe(true);
    expect(result.structuredContent.decoded_data.status).toBe("success");
    expect(result.structuredContent.decoded_data.payment_id).toBe(12345);
    expect(result.structuredContent.decoded_data.order_id).toBe("e2e-callback");
  });
});
