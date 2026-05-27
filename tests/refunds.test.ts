import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerRefundTools } from "../src/tools/refunds.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerRefundTools(server, client);
  return server;
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<any> {
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool ${name} not registered`);
  return tool.handler(args, {} as any);
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("liqpay_create_refund", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("returns refund result on full refund", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "reversed", payment_id: 100, amount: 500 }),
    });

    const result = await callTool(server, "liqpay_create_refund", { order_id: "ord-1" });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.status).toBe("reversed");
    expect(result.structuredContent.payment_id).toBe(100);
    expect(result.structuredContent.amount).toBe(500);
  });

  it("sends amount for partial refund", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "reversed", payment_id: 101, amount: 200 }),
    });

    await callTool(server, "liqpay_create_refund", { order_id: "ord-2", amount: 200 });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.action).toBe("refund");
    expect(data.amount).toBe(200);
  });

  it("omits amount field when not provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "reversed", payment_id: 102 }),
    });

    await callTool(server, "liqpay_create_refund", { order_id: "ord-3" });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.amount).toBeUndefined();
  });

  it("returns isError on refund failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "error", err_code: "err_refund", err_description: "Already refunded" }),
    });

    const result = await callTool(server, "liqpay_create_refund", { order_id: "ord-dup" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("err_refund");
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "processing", payment_id: 103, amount: 50 }),
    });

    const result = await callTool(server, "liqpay_create_refund", { order_id: "ord-4" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("processing");
    expect(result.structuredContent.status).toBe("processing");
  });
});
