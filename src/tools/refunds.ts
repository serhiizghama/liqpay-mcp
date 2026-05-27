import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiqPayClient } from "../client.js";
import type { LiqPayResponse } from "../types.js";

export function registerRefundTools(server: McpServer, client: LiqPayClient): void {
  server.registerTool(
    "liqpay_create_refund",
    {
      title: "Create LiqPay Refund",
      description:
        "Refund a completed payment — full or partial (action: refund). " +
        "Use when a customer requests a return or when a charge was made in error. " +
        "Do not use on holds — cancel the hold with liqpay_cancel_hold instead. " +
        "Returns { payment_id, status, amount }.",
      inputSchema: {
        order_id: z.string().min(1).describe("Order ID of the original payment to refund (e.g. 'order-2026-001')"),
        amount: z.number().positive().optional().describe("Amount to refund in currency units (e.g. 50.00); omit for full refund"),
      },
      outputSchema: {
        payment_id: z.number().describe("LiqPay internal payment ID"),
        status: z.string().describe("Refund status (e.g. reversed, processing)"),
        amount: z.number().optional().describe("Refunded amount"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ order_id, amount }) => {
      try {
        const params: Record<string, unknown> = { action: "refund", order_id };
        if (amount !== undefined) params["amount"] = amount;

        const result = await client.request<LiqPayResponse>(params);

        const output = {
          payment_id: result.payment_id,
          status: result.status,
          amount: result.amount,
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
