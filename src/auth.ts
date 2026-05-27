import { createHash } from "node:crypto";

export function createSignature(data: string, privateKey: string): string {
  return createHash("sha1")
    .update(privateKey + data + privateKey)
    .digest("base64");
}

export function encodeData(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodeData(data: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(data, "base64").toString("utf-8")) as Record<string, unknown>;
}
