import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerPayoutTools } from "../src/tools/payouts.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerPayoutTools(server, client);
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

describe("liqpay_create_payout", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  const payoutArgs = {
    amount: 1000,
    currency: "UAH",
    description: "Salary payout — May 2026",
    order_id: "payout-001",
    card: "5168742060221193",
  };

  it("returns payout result on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", payment_id: 300, amount: 1000, currency: "UAH" }),
    });

    const result = await callTool(server, "liqpay_create_payout", payoutArgs);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.status).toBe("success");
    expect(result.structuredContent.payment_id).toBe(300);
    expect(result.structuredContent.amount).toBe(1000);
    expect(result.structuredContent.currency).toBe("UAH");
  });

  it("sends p2p action with card", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", payment_id: 301, amount: 1000, currency: "UAH" }),
    });

    await callTool(server, "liqpay_create_payout", payoutArgs);

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.action).toBe("p2p");
    expect(data.card).toBe("5168742060221193");
    expect(data.amount).toBe(1000);
  });

  it("returns isError on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "error", err_code: "err_limit", err_description: "Daily limit exceeded" }),
    });

    const result = await callTool(server, "liqpay_create_payout", payoutArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("err_limit");
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "processing", payment_id: 302, amount: 500, currency: "USD" }),
    });

    const result = await callTool(server, "liqpay_create_payout", { ...payoutArgs, amount: 500, currency: "USD" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("processing");
    expect(result.structuredContent.status).toBe("processing");
  });

  it("handles HTTP errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    const result = await callTool(server, "liqpay_create_payout", payoutArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Access denied");
  });
});
