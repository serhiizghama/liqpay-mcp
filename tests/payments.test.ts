import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerPaymentTools } from "../src/tools/payments.js";
import { decodeData } from "../src/auth.js";
import { LIQPAY_CHECKOUT_URL } from "../src/constants.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerPaymentTools(server, client);
  return server;
}

async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }>; structuredContent?: Record<string, unknown>; isError?: boolean }> {
  const tool = (server as any)._registeredTools[name];
  if (!tool) throw new Error(`Tool ${name} not registered`);
  return tool.handler(args, {} as any) as any;
}

describe("liqpay_create_checkout_url", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("returns a checkout URL with data and signature", async () => {
    const result = await callTool(server, "liqpay_create_checkout_url", {
      amount: 100,
      currency: "UAH",
      description: "Test payment",
      order_id: "ord-1",
      language: "uk",
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeDefined();
    const url = (result.structuredContent as any).checkout_url as string;
    expect(url).toContain(LIQPAY_CHECKOUT_URL);
    expect(url).toContain("data=");
    expect(url).toContain("signature=");
  });

  it("embeds correct action and amount in the URL data", async () => {
    const result = await callTool(server, "liqpay_create_checkout_url", {
      amount: 49.99,
      currency: "USD",
      description: "USD order",
      order_id: "ord-usd",
      language: "en",
    });

    const url = (result.structuredContent as any).checkout_url as string;
    const dataParam = new URL(url).searchParams.get("data")!;
    const decoded = decodeData(dataParam);
    expect(decoded["action"]).toBe("pay");
    expect(decoded["amount"]).toBe(49.99);
    expect(decoded["currency"]).toBe("USD");
    expect(decoded["language"]).toBe("en");
  });

  it("includes optional result_url and server_url", async () => {
    const result = await callTool(server, "liqpay_create_checkout_url", {
      amount: 10,
      currency: "EUR",
      description: "With URLs",
      order_id: "ord-urls",
      result_url: "https://example.com/result",
      server_url: "https://example.com/webhook",
      language: "uk",
    });

    const url = (result.structuredContent as any).checkout_url as string;
    const decoded = decodeData(new URL(url).searchParams.get("data")!);
    expect(decoded["result_url"]).toBe("https://example.com/result");
    expect(decoded["server_url"]).toBe("https://example.com/webhook");
  });

  it("returns content as JSON text and structuredContent", async () => {
    const result = await callTool(server, "liqpay_create_checkout_url", {
      amount: 1,
      currency: "UAH",
      description: "t",
      order_id: "o",
      language: "uk",
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.checkout_url).toBe((result.structuredContent as any).checkout_url);
  });

  it("omits undefined optional params from data", async () => {
    const result = await callTool(server, "liqpay_create_checkout_url", {
      amount: 5,
      currency: "UAH",
      description: "no opts",
      order_id: "ord-no-opts",
      language: "uk",
    });

    const url = (result.structuredContent as any).checkout_url as string;
    const decoded = decodeData(new URL(url).searchParams.get("data")!);
    expect(decoded["result_url"]).toBeUndefined();
    expect(decoded["server_url"]).toBeUndefined();
  });
});

describe("liqpay_get_payment_status", () => {
  let server: McpServer;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    server = createServer();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns payment status on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: "success",
        payment_id: 123,
        amount: 100,
        currency: "UAH",
        description: "Test",
        create_date: 1716768000000,
        end_date: 1716768060000,
        transaction_id: 456,
      }),
    });

    const result = await callTool(server, "liqpay_get_payment_status", { order_id: "ord-1" });

    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as any).status).toBe("success");
    expect((result.structuredContent as any).payment_id).toBe(123);
    expect((result.structuredContent as any).amount).toBe(100);
  });

  it("returns isError on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: "error",
        err_code: "err_order_id",
        err_description: "Order not found",
      }),
    });

    const result = await callTool(server, "liqpay_get_payment_status", { order_id: "bad-id" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("err_order_id");
  });

  it("returns isError on HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await callTool(server, "liqpay_get_payment_status", { order_id: "ord-1" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("server error");
  });

  it("returns both content text and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: "processing",
        payment_id: 789,
        amount: 50,
        currency: "USD",
      }),
    });

    const result = await callTool(server, "liqpay_get_payment_status", { order_id: "ord-2" });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.status).toBe("processing");
    expect(result.structuredContent).toBeDefined();
    expect((result.structuredContent as any).status).toBe("processing");
  });

  it("handles network errors gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network unreachable"));

    const result = await callTool(server, "liqpay_get_payment_status", { order_id: "ord-1" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Network unreachable");
  });
});
