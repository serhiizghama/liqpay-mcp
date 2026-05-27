import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerSubscriptionTools } from "../src/tools/subscriptions.js";
import { decodeData } from "../src/auth.js";
import { LIQPAY_CHECKOUT_URL } from "../src/constants.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerSubscriptionTools(server, client);
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

describe("liqpay_create_subscription", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  const subArgs = {
    amount: 299,
    currency: "UAH",
    description: "Monthly Pro plan",
    order_id: "sub-001",
    subscribe_date_start: "2026-06-01 00:00:00",
    subscribe_periodicity: "month",
  };

  it("returns a checkout URL", async () => {
    const result = await callTool(server, "liqpay_create_subscription", subArgs);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.checkout_url).toContain(LIQPAY_CHECKOUT_URL);
  });

  it("encodes subscribe action with periodicity", async () => {
    const result = await callTool(server, "liqpay_create_subscription", subArgs);

    const url = result.structuredContent.checkout_url as string;
    const decoded = decodeData(new URL(url).searchParams.get("data")!);
    expect(decoded["action"]).toBe("subscribe");
    expect(decoded["subscribe_periodicity"]).toBe("month");
    expect(decoded["subscribe_date_start"]).toBe("2026-06-01 00:00:00");
    expect(decoded["amount"]).toBe(299);
  });

  it("includes optional URLs in data", async () => {
    const result = await callTool(server, "liqpay_create_subscription", {
      ...subArgs,
      result_url: "https://example.com/done",
      server_url: "https://example.com/hook",
    });

    const url = result.structuredContent.checkout_url as string;
    const decoded = decodeData(new URL(url).searchParams.get("data")!);
    expect(decoded["result_url"]).toBe("https://example.com/done");
    expect(decoded["server_url"]).toBe("https://example.com/hook");
  });

  it("omits optional URLs when not provided", async () => {
    const result = await callTool(server, "liqpay_create_subscription", subArgs);

    const url = result.structuredContent.checkout_url as string;
    const decoded = decodeData(new URL(url).searchParams.get("data")!);
    expect(decoded["result_url"]).toBeUndefined();
    expect(decoded["server_url"]).toBeUndefined();
  });

  it("returns both content and structuredContent", async () => {
    const result = await callTool(server, "liqpay_create_subscription", subArgs);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.checkout_url).toBe(result.structuredContent.checkout_url);
  });
});

describe("liqpay_cancel_subscription", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("returns unsubscribed status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "unsubscribed" }),
    });

    const result = await callTool(server, "liqpay_cancel_subscription", { order_id: "sub-001" });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.status).toBe("unsubscribed");
  });

  it("sends unsubscribe action", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "unsubscribed" }),
    });

    await callTool(server, "liqpay_cancel_subscription", { order_id: "sub-002" });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.action).toBe("unsubscribe");
    expect(data.order_id).toBe("sub-002");
  });

  it("returns isError on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "error", err_code: "err_payment", err_description: "Not found" }),
    });

    const result = await callTool(server, "liqpay_cancel_subscription", { order_id: "sub-bad" });

    expect(result.isError).toBe(true);
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "unsubscribed" }),
    });

    const result = await callTool(server, "liqpay_cancel_subscription", { order_id: "sub-003" });

    expect(JSON.parse(result.content[0].text).status).toBe("unsubscribed");
    expect(result.structuredContent.status).toBe("unsubscribed");
  });

  it("handles network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

    const result = await callTool(server, "liqpay_cancel_subscription", { order_id: "sub-001" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Timeout");
  });
});
