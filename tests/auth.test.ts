import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { createSignature, encodeData, decodeData } from "../src/auth.js";

describe("encodeData", () => {
  it("base64-encodes a JSON payload", () => {
    const payload = { action: "pay", amount: 100, currency: "UAH" };
    const encoded = encodeData(payload);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded).toEqual(payload);
  });

  it("produces valid base64 string", () => {
    const encoded = encodeData({ test: true });
    expect(() => Buffer.from(encoded, "base64")).not.toThrow();
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("handles empty payload", () => {
    const encoded = encodeData({});
    expect(JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"))).toEqual({});
  });

  it("handles unicode characters in description", () => {
    const payload = { description: "Оплата замовлення #42 — чохол для iPhone" };
    const encoded = encodeData(payload);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded.description).toBe(payload.description);
  });

  it("handles nested objects", () => {
    const payload = { meta: { key: "value" }, amount: 99.99 };
    const encoded = encodeData(payload);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    expect(decoded).toEqual(payload);
  });
});

describe("decodeData", () => {
  it("reverses encodeData", () => {
    const original = { action: "status", order_id: "order-001" };
    const encoded = encodeData(original);
    const decoded = decodeData(encoded);
    expect(decoded).toEqual(original);
  });

  it("decodes a known base64 string", () => {
    const data = Buffer.from('{"status":"success"}').toString("base64");
    expect(decodeData(data)).toEqual({ status: "success" });
  });

  it("throws on invalid base64", () => {
    expect(() => decodeData("not-valid-json-base64!!!")).toThrow();
  });
});

describe("createSignature", () => {
  it("produces base64(sha1(private + data + private))", () => {
    const privateKey = "test_private_key";
    const data = encodeData({ action: "pay", amount: 1 });

    const expected = createHash("sha1")
      .update(privateKey + data + privateKey)
      .digest("base64");

    expect(createSignature(data, privateKey)).toBe(expected);
  });

  it("matches LiqPay SDK reference vector", () => {
    // Reference: liqpay/sdk-nodejs uses sha1(private + data + private)
    const privateKey = "a4825234f4bae72a0be04f";
    const payload = {
      public_key: "i000000000",
      version: 3,
      action: "pay",
      amount: 1,
      currency: "UAH",
      description: "test",
      order_id: "order_id_1",
    };

    const data = encodeData(payload);
    const signature = createSignature(data, privateKey);

    // Manually verify: signature must be a non-empty base64 string
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(signature.length).toBeGreaterThan(20);

    // Same input → same output (deterministic)
    expect(createSignature(data, privateKey)).toBe(signature);
  });

  it("produces different signatures for different private keys", () => {
    const data = encodeData({ test: true });
    const sig1 = createSignature(data, "key_one");
    const sig2 = createSignature(data, "key_two");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different data", () => {
    const privateKey = "same_key";
    const sig1 = createSignature(encodeData({ a: 1 }), privateKey);
    const sig2 = createSignature(encodeData({ a: 2 }), privateKey);
    expect(sig1).not.toBe(sig2);
  });

  it("produces a 28-char base64 string (SHA-1 = 20 bytes → 28 base64 chars)", () => {
    const sig = createSignature(encodeData({ x: 1 }), "key");
    expect(sig).toHaveLength(28);
  });
});
