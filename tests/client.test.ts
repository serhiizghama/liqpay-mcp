import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiqPayClient } from "../src/client.js";
import { LIQPAY_API_URL, LIQPAY_CHECKOUT_URL, LIQPAY_API_VERSION } from "../src/constants.js";
import { decodeData } from "../src/auth.js";

const PUBLIC_KEY = "test_public_key";
const PRIVATE_KEY = "test_private_key";

describe("LiqPayClient", () => {
  let client: LiqPayClient;

  beforeEach(() => {
    client = new LiqPayClient(PUBLIC_KEY, PRIVATE_KEY);
  });

  describe("buildCheckoutUrl", () => {
    it("returns a URL with data and signature params", () => {
      const url = client.buildCheckoutUrl({ action: "pay", amount: 100, currency: "UAH", description: "test", order_id: "o1" });
      expect(url).toContain(LIQPAY_CHECKOUT_URL);
      expect(url).toContain("data=");
      expect(url).toContain("signature=");
    });

    it("includes version and public_key in the encoded data", () => {
      const url = client.buildCheckoutUrl({ action: "pay", amount: 50, currency: "USD", description: "t", order_id: "o2" });
      const dataParam = new URL(url).searchParams.get("data");
      expect(dataParam).toBeTruthy();
      const decoded = decodeData(dataParam!);
      expect(decoded["version"]).toBe(LIQPAY_API_VERSION);
      expect(decoded["public_key"]).toBe(PUBLIC_KEY);
      expect(decoded["action"]).toBe("pay");
      expect(decoded["amount"]).toBe(50);
    });

    it("preserves all passed parameters in data", () => {
      const params = { action: "pay", amount: 99.99, currency: "EUR", description: "Order #1", order_id: "ord-1", language: "en" };
      const url = client.buildCheckoutUrl(params);
      const dataParam = new URL(url).searchParams.get("data")!;
      const decoded = decodeData(dataParam);
      expect(decoded["amount"]).toBe(99.99);
      expect(decoded["currency"]).toBe("EUR");
      expect(decoded["language"]).toBe("en");
    });

    it("URL-encodes data and signature", () => {
      const url = client.buildCheckoutUrl({ action: "pay", amount: 1, currency: "UAH", description: "t", order_id: "o" });
      // base64 may contain + and / which must be URL-encoded
      const raw = url.split("?")[1]!;
      expect(raw).not.toContain(" ");
    });
  });

  describe("request", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("sends POST to LIQPAY_API_URL with form-encoded body", async () => {
      const mockResponse = { status: "success", payment_id: 123, amount: 100, currency: "UAH" };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.request({ action: "status", order_id: "o1" });

      expect(globalThis.fetch).toHaveBeenCalledOnce();
      const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe(LIQPAY_API_URL);
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded" });
      expect(result).toEqual(mockResponse);
    });

    it("includes version and public_key in encoded data", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "success" }),
      });

      await client.request({ action: "status", order_id: "o1" });

      const body = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1]!.body as string;
      const params = new URLSearchParams(body);
      const decoded = decodeData(params.get("data")!);
      expect(decoded["version"]).toBe(LIQPAY_API_VERSION);
      expect(decoded["public_key"]).toBe(PUBLIC_KEY);
    });

    it("throws on HTTP error with actionable message", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      await expect(client.request({ action: "status", order_id: "o1" })).rejects.toThrow(/Authentication failed/);
    });

    it("throws on LiqPay error response", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "error", err_code: "err_auth", err_description: "Bad key" }),
      });

      await expect(client.request({ action: "status", order_id: "o1" })).rejects.toThrow(/err_auth/);
    });

    it("returns data on success", async () => {
      const expected = { status: "success", payment_id: 456, amount: 250, currency: "UAH" };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(expected),
      });

      const result = await client.request({ action: "status", order_id: "o2" });
      expect(result).toEqual(expected);
    });
  });
});
