import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiqPayClient } from "../client.js";
import type { LiqPayResponse } from "../types.js";

export function registerPaymentTools(server: McpServer, client: LiqPayClient): void {
  server.registerTool(
    "liqpay_create_checkout_url",
    {
      title: "Create LiqPay Checkout URL",
      description:
        "Generate a hosted checkout URL for a LiqPay payment (PCI DSS safe). " +
        "Use when initiating a payment without handling card data directly. " +
        "Do not use for server-to-server card charges — use liqpay_create_hold instead. " +
        "Returns { checkout_url: string }.",
      inputSchema: {
        amount: z.number().positive().describe("Payment amount in currency units (e.g. 99.99 for ₴99.99)"),
        currency: z.enum(["UAH", "USD", "EUR"]).describe("ISO 4217 currency code"),
        description: z.string().min(1).max(500).describe("Payment description shown to payer (max 500 chars, e.g. 'Order #42 — iPhone case')"),
        order_id: z.string().min(1).describe("Unique order ID in your system (e.g. 'order-2026-001')"),
        result_url: z.string().url().optional().describe("Redirect URL after payment completion"),
        server_url: z.string().url().optional().describe("Webhook URL for server-to-server notification"),
        language: z.enum(["uk", "en"]).default("uk").describe("Payment page language"),
      },
      outputSchema: {
        checkout_url: z.string().describe("Direct link to LiqPay hosted payment page"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ amount, currency, description, order_id, result_url, server_url, language }) => {
      const params: Record<string, unknown> = {
        action: "pay",
        amount,
        currency,
        description,
        order_id,
        language,
      };
      if (result_url) params["result_url"] = result_url;
      if (server_url) params["server_url"] = server_url;

      const checkout_url = client.buildCheckoutUrl(params);
      const output = { checkout_url };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "liqpay_get_payment_status",
    {
      title: "Get LiqPay Payment Status",
      description:
        "Fetch the current status of a payment by order ID (action: status). " +
        "Use when checking whether a payment succeeded, failed, or is still pending. " +
        "Do not use to list multiple payments — use liqpay_get_payments_list instead. " +
        "Returns { status, payment_id, amount, currency, description, create_date, end_date, transaction_id }.",
      inputSchema: {
        order_id: z.string().min(1).describe("Order ID used when creating the payment (e.g. 'order-2026-001')"),
      },
      outputSchema: {
        status: z.string().describe("Payment status (e.g. success, failure, processing)"),
        payment_id: z.number().describe("LiqPay internal payment ID"),
        amount: z.number().describe("Payment amount"),
        currency: z.string().describe("ISO 4217 currency code"),
        description: z.string().optional().describe("Payment description"),
        create_date: z.number().optional().describe("Payment creation timestamp (ms)"),
        end_date: z.number().optional().describe("Payment completion timestamp (ms)"),
        transaction_id: z.number().optional().describe("Bank transaction ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ order_id }) => {
      try {
        const result = await client.request<LiqPayResponse>({ action: "status", order_id });

        const output = {
          status: result.status,
          payment_id: result.payment_id,
          amount: result.amount,
          currency: result.currency,
          description: result.description,
          create_date: result.create_date,
          end_date: result.end_date,
          transaction_id: result.transaction_id,
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
