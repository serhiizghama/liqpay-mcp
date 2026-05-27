import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LiqPayClient } from "../src/client.js";
import { registerHoldTools } from "../src/tools/holds.js";

const PUBLIC_KEY = "test_pub";
const PRIVATE_KEY = "test_priv";

function createServer(): McpServer {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  registerHoldTools(server, client);
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

describe("liqpay_create_hold", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  const holdArgs = {
    amount: 500,
    currency: "UAH",
    description: "Hold for order #7",
    order_id: "hold-001",
    card: "4111111111111111",
    card_exp_month: "12",
    card_exp_year: "29",
    card_cvv: "123",
  };

  it("returns hold result on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "hold_wait", payment_id: 200, amount: 500, currency: "UAH" }),
    });

    const result = await callTool(server, "liqpay_create_hold", holdArgs);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.status).toBe("hold_wait");
    expect(result.structuredContent.payment_id).toBe(200);
    expect(result.structuredContent.amount).toBe(500);
  });

  it("sends correct action and card data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "hold_wait", payment_id: 201, amount: 500, currency: "UAH" }),
    });

    await callTool(server, "liqpay_create_hold", holdArgs);

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.action).toBe("hold");
    expect(data.card).toBe("4111111111111111");
    expect(data.card_cvv).toBe("123");
  });

  it("returns isError on payment failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "error", err_code: "err_payment", err_description: "Card declined" }),
    });

    const result = await callTool(server, "liqpay_create_hold", holdArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("err_payment");
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "hold_wait", payment_id: 202, amount: 100, currency: "USD" }),
    });

    const result = await callTool(server, "liqpay_create_hold", { ...holdArgs, amount: 100, currency: "USD" });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("hold_wait");
    expect(result.structuredContent.status).toBe("hold_wait");
  });

  it("handles network errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await callTool(server, "liqpay_create_hold", holdArgs);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Connection refused");
  });
});

describe("liqpay_complete_hold", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("captures full amount", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", payment_id: 200 }),
    });

    const result = await callTool(server, "liqpay_complete_hold", { order_id: "hold-001" });

    expect(result.structuredContent.status).toBe("success");
    expect(result.structuredContent.payment_id).toBe(200);
  });

  it("sends partial capture amount", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", payment_id: 200 }),
    });

    await callTool(server, "liqpay_complete_hold", { order_id: "hold-001", amount: 250 });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.action).toBe("hold_completion");
    expect(data.amount).toBe(250);
  });

  it("omits amount for full capture", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", payment_id: 200 }),
    });

    await callTool(server, "liqpay_complete_hold", { order_id: "hold-001" });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.amount).toBeUndefined();
  });

  it("returns isError on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "error", err_code: "err_payment", err_description: "Hold expired" }),
    });

    const result = await callTool(server, "liqpay_complete_hold", { order_id: "hold-expired" });

    expect(result.isError).toBe(true);
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "success", payment_id: 203 }),
    });

    const result = await callTool(server, "liqpay_complete_hold", { order_id: "hold-002" });

    expect(JSON.parse(result.content[0].text).status).toBe("success");
    expect(result.structuredContent.status).toBe("success");
  });
});

describe("liqpay_cancel_hold", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createServer();
  });

  it("reverses a hold", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "reversed", payment_id: 200 }),
    });

    const result = await callTool(server, "liqpay_cancel_hold", { order_id: "hold-001" });

    expect(result.structuredContent.status).toBe("reversed");
    expect(result.structuredContent.payment_id).toBe(200);
  });

  it("sends hold_completion with reversal flag", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "reversed", payment_id: 200 }),
    });

    await callTool(server, "liqpay_cancel_hold", { order_id: "hold-001" });

    const body = (globalThis.fetch as any).mock.calls[0][1].body as string;
    const data = JSON.parse(Buffer.from(new URLSearchParams(body).get("data")!, "base64").toString());
    expect(data.action).toBe("hold_completion");
    expect(data.flag).toBe("reversal");
  });

  it("returns isError when hold already captured", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "error", err_code: "err_payment", err_description: "Already completed" }),
    });

    const result = await callTool(server, "liqpay_cancel_hold", { order_id: "hold-done" });

    expect(result.isError).toBe(true);
  });

  it("returns both content and structuredContent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "reversed", payment_id: 204 }),
    });

    const result = await callTool(server, "liqpay_cancel_hold", { order_id: "hold-003" });

    expect(JSON.parse(result.content[0].text).status).toBe("reversed");
    expect(result.structuredContent.status).toBe("reversed");
  });

  it("handles HTTP errors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    const result = await callTool(server, "liqpay_cancel_hold", { order_id: "hold-001" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("server error");
  });
});
