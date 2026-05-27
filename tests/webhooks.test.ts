import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWebhookTools } from "../src/tools/webhooks.js";
import { createSignature, encodeData } from "../src/auth.js";

const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerWebhookTools(server, PRIVATE_KEY);
  return server;
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<any> {
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool ${name} not registered`);
  return tool.handler(args, {} as any);
}

describe("liqpay_verify_callback", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("validates a correct signature", async () => {
    const payload = { status: "success", payment_id: 123, amount: 100, currency: "UAH", order_id: "ord-1" };
    const data = encodeData(payload);
    const signature = createSignature(data, PRIVATE_KEY);

    const result = await callTool(server, "liqpay_verify_callback", { data, signature });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.valid).toBe(true);
    expect(result.structuredContent.decoded_data).toEqual(payload);
  });

  it("rejects an invalid signature", async () => {
    const data = encodeData({ status: "success" });
    const badSignature = "completely_wrong_signature";

    const result = await callTool(server, "liqpay_verify_callback", { data, signature: badSignature });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.valid).toBe(false);
    expect(result.structuredContent.decoded_data).toBeUndefined();
  });

  it("rejects signature from a different private key", async () => {
    const data = encodeData({ status: "failure" });
    const wrongKeySignature = createSignature(data, "different_private_key");

    const result = await callTool(server, "liqpay_verify_callback", { data, signature: wrongKeySignature });

    expect(result.structuredContent.valid).toBe(false);
  });

  it("decodes Ukrainian text in callback data", async () => {
    const payload = { description: "Оплата замовлення #42", status: "success" };
    const data = encodeData(payload);
    const signature = createSignature(data, PRIVATE_KEY);

    const result = await callTool(server, "liqpay_verify_callback", { data, signature });

    expect(result.structuredContent.valid).toBe(true);
    expect(result.structuredContent.decoded_data.description).toBe("Оплата замовлення #42");
  });

  it("returns both content text and structuredContent", async () => {
    const data = encodeData({ test: true });
    const signature = createSignature(data, PRIVATE_KEY);

    const result = await callTool(server, "liqpay_verify_callback", { data, signature });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.valid).toBe(true);
    expect(result.structuredContent.valid).toBe(true);
  });
});
