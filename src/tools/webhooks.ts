import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createSignature, decodeData } from "../auth.js";

export function registerWebhookTools(server: McpServer, privateKey: string): void {
  server.registerTool(
    "liqpay_verify_callback",
    {
      title: "Verify LiqPay Callback",
      description:
        "Validate an incoming LiqPay webhook signature to confirm authenticity. " +
        "Use when processing a callback from LiqPay to verify it was not tampered with. " +
        "Do not use for outgoing requests — signature is built automatically by the client. " +
        "Returns { valid: boolean, decoded_data: object }.",
      inputSchema: {
        data: z.string().min(1).describe("Raw 'data' field from the webhook POST body (base64-encoded string)"),
        signature: z.string().min(1).describe("Raw 'signature' field from the webhook POST body (base64-encoded string)"),
      },
      outputSchema: {
        valid: z.boolean().describe("Whether the signature is authentic"),
        decoded_data: z.record(z.unknown()).optional().describe("Decoded payment data from the callback (only if valid)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ data, signature }) => {
      try {
        const expectedSignature = createSignature(data, privateKey);
        const valid = expectedSignature === signature;

        const output: { valid: boolean; decoded_data?: Record<string, unknown> } = { valid };

        if (valid) {
          output.decoded_data = decodeData(data);
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );
}
