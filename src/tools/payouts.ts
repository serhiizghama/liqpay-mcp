import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiqPayClient } from "../client.js";
import type { LiqPayResponse } from "../types.js";

export function registerPayoutTools(server: McpServer, client: LiqPayClient): void {
  server.registerTool(
    "liqpay_create_payout",
    {
      title: "Create LiqPay Payout",
      description:
        "Send money directly to a card — P2P transfer (action: p2p). " +
        "Use when the merchant needs to pay out funds to a recipient's card. " +
        "Do not use without payout feature enabled on the merchant account. " +
        "Returns { payment_id, status, amount, currency }.",
      inputSchema: {
        amount: z.number().positive().describe("Payout amount in currency units (e.g. 500.00)"),
        currency: z.enum(["UAH", "USD", "EUR"]).describe("ISO 4217 currency code"),
        description: z.string().min(1).max(500).describe("Purpose of payout (e.g. 'Salary payout — May 2026')"),
        order_id: z.string().min(1).describe("Unique payout ID (e.g. 'payout-2026-001')"),
        card: z.string().regex(/^\d{16}$/).describe("Recipient card number — exactly 16 digits (e.g. '5168742060221193')"),
      },
      outputSchema: {
        payment_id: z.number().describe("LiqPay internal payment ID"),
        status: z.string().describe("Payout status (e.g. success, processing)"),
        amount: z.number().describe("Payout amount"),
        currency: z.string().describe("ISO 4217 currency code"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ amount, currency, description, order_id, card }) => {
      try {
        const result = await client.request<LiqPayResponse>({
          action: "p2p",
          amount,
          currency,
          description,
          order_id,
          card,
        });

        const output = {
          payment_id: result.payment_id,
          status: result.status,
          amount: result.amount,
          currency: result.currency,
        };

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
