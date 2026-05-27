import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerReportTools } from "../src/tools/reports.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerReportTools(server, client);
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

describe("liqpay_get_payments_list", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("returns payments list on success", async () => {
    const payments = [
      { status: "success", payment_id: 1, amount: 100, currency: "UAH" },
      { status: "success", payment_id: 2, amount: 200, currency: "UAH" },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: "ok", count: 2, data: payments }),
    });

    const result = await callTool(server, "liqpay_get_payments_list", {
      date_from: 1716768000000,
      date_to: 1716854400000,
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.count).toBe(2);
    expect(result.structuredContent.data).toHaveLength(2);
  });

  it("passes status filter when provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: "ok", count: 0, data: [] }),
    });

    await callTool(server, "liqpay_get_payments_list", {
      date_from: 1716768000000,
      date_to: 1716854400000,
      status: "reversed",
    });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.status).toBe("reversed");
  });

  it("returns isError on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    const result = await callTool(server, "liqpay_get_payments_list", {
      date_from: 1716768000000,
      date_to: 1716854400000,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rate limit");
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: "ok", count: 1, data: [{ status: "success" }] }),
    });

    const result = await callTool(server, "liqpay_get_payments_list", {
      date_from: 1716768000000,
      date_to: 1716854400000,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.count).toBe(1);
    expect(result.structuredContent).toBeDefined();
  });

  it("handles empty results", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: "ok", count: 0, data: [] }),
    });

    const result = await callTool(server, "liqpay_get_payments_list", {
      date_from: 1716768000000,
      date_to: 1716854400000,
    });

    expect(result.structuredContent.count).toBe(0);
    expect(result.structuredContent.data).toHaveLength(0);
  });
});
