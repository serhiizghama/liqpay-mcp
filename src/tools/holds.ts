import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiqPayClient } from "../client.js";
import type { LiqPayResponse } from "../types.js";

export function registerHoldTools(server: McpServer, client: LiqPayClient): void {
  server.registerTool(
    "liqpay_create_hold",
    {
      title: "Create LiqPay Hold",
      description:
        "Pre-authorize (freeze) funds on the payer's card without capturing them (action: hold). " +
        "Use when you need a 2-step payment: reserve first, charge later. " +
        "Do not use if the merchant is not PCI DSS compliant — use liqpay_create_checkout_url instead. " +
        "Returns { payment_id, status, amount, currency }.",
      inputSchema: {
        amount: z.number().positive().describe("Amount to hold in currency units (e.g. 250.00)"),
        currency: z.enum(["UAH", "USD", "EUR"]).describe("ISO 4217 currency code"),
        description: z.string().min(1).max(500).describe("Payment description shown to payer (max 500 chars, e.g. 'Order #42 — iPhone case')"),
        order_id: z.string().min(1).describe("Unique order ID in your system (e.g. 'hold-2026-001')"),
        card: z.string().regex(/^\d{16}$/).describe("Payer's card number — exactly 16 digits (e.g. '4111111111111111')"),
        card_exp_month: z.string().regex(/^(0[1-9]|1[0-2])$/).describe("Card expiry month in MM format (e.g. '03')"),
        card_exp_year: z.string().regex(/^\d{2}$/).describe("Card expiry year in YY format (e.g. '29')"),
        card_cvv: z.string().regex(/^\d{3,4}$/).describe("Card CVV code — 3 or 4 digits (e.g. '123')"),
      },
      outputSchema: {
        payment_id: z.number().describe("LiqPay internal payment ID"),
        status: z.string().describe("Hold status (e.g. hold_wait)"),
        amount: z.number().describe("Held amount"),
        currency: z.string().describe("ISO 4217 currency code"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ amount, currency, description, order_id, card, card_exp_month, card_exp_year, card_cvv }) => {
      try {
        const result = await client.request<LiqPayResponse>({
          action: "hold",
          amount,
          currency,
          description,
          order_id,
          card,
          card_exp_month,
          card_exp_year,
          card_cvv,
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

  server.registerTool(
    "liqpay_complete_hold",
    {
      title: "Complete LiqPay Hold",
      description:
        "Capture previously held funds — completes the 2-step payment (action: hold_completion). " +
        "Use after liqpay_create_hold to actually charge the frozen amount. " +
        "Do not use if the hold has already been cancelled — it will return an error. " +
        "Returns { status, payment_id }.",
      inputSchema: {
        order_id: z.string().min(1).describe("Order ID from the original liqpay_create_hold call (e.g. 'hold-2026-001')"),
        amount: z.number().positive().optional().describe("Partial capture amount ≤ held amount (e.g. 150.00); omit for full capture"),
      },
      outputSchema: {
        status: z.string().describe("Capture status (e.g. success, error)"),
        payment_id: z.number().describe("LiqPay internal payment ID"),
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
        const params: Record<string, unknown> = { action: "hold_completion", order_id };
        if (amount !== undefined) params["amount"] = amount;

        const result = await client.request<LiqPayResponse>(params);

        const output = {
          status: result.status,
          payment_id: result.payment_id,
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

  server.registerTool(
    "liqpay_cancel_hold",
    {
      title: "Cancel LiqPay Hold",
      description:
        "Release held funds back to payer without capture (action: hold_completion with flag). " +
        "Use to cancel a previously created hold when the order is no longer needed. " +
        "Do not use if funds have already been captured via liqpay_complete_hold. " +
        "Returns { status, payment_id }.",
      inputSchema: {
        order_id: z.string().min(1).describe("Order ID from the original liqpay_create_hold call (e.g. 'hold-2026-001')"),
      },
      outputSchema: {
        status: z.string().describe("Reversal status (e.g. reversed)"),
        payment_id: z.number().describe("LiqPay internal payment ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ order_id }) => {
      try {
        const result = await client.request<LiqPayResponse>({
          action: "hold_completion",
          order_id,
          flag: "reversal",
        });

        const output = {
          status: result.status,
          payment_id: result.payment_id,
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
