import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiqPayClient } from "../client.js";
import type { LiqPayResponse } from "../types.js";

export function registerSubscriptionTools(server: McpServer, client: LiqPayClient): void {
  server.registerTool(
    "liqpay_create_subscription",
    {
      title: "Create LiqPay Subscription",
      description:
        "Create a recurring payment subscription via hosted checkout page (action: subscribe). " +
        "Use when setting up periodic charges (daily, weekly, monthly, yearly). " +
        "Do not use for one-time payments — use liqpay_create_checkout_url instead. " +
        "Returns { checkout_url: string }.",
      inputSchema: {
        amount: z.number().positive().describe("Amount per billing cycle in currency units (e.g. 299.00)"),
        currency: z.enum(["UAH", "USD", "EUR"]).describe("ISO 4217 currency code"),
        description: z.string().min(1).max(500).describe("Subscription description (max 500 chars, e.g. 'Monthly Pro plan')"),
        order_id: z.string().min(1).describe("Unique subscription ID (e.g. 'sub-2026-001')"),
        subscribe_date_start: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).describe("First charge date in 'YYYY-MM-DD HH:mm:ss' format (e.g. '2026-06-01 00:00:00')"),
        subscribe_periodicity: z.enum(["day", "week", "month", "year"]).describe("Billing cycle interval"),
        result_url: z.string().url().optional().describe("Redirect URL after subscription setup"),
        server_url: z.string().url().optional().describe("Webhook URL for recurring charge notifications"),
      },
      outputSchema: {
        checkout_url: z.string().describe("Checkout page URL for the subscriber to enter card details"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ amount, currency, description, order_id, subscribe_date_start, subscribe_periodicity, result_url, server_url }) => {
      const params: Record<string, unknown> = {
        action: "subscribe",
        amount,
        currency,
        description,
        order_id,
        subscribe_date_start,
        subscribe_periodicity,
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
    "liqpay_cancel_subscription",
    {
      title: "Cancel LiqPay Subscription",
      description:
        "Cancel an active recurring subscription (action: unsubscribe). " +
        "Use when a subscriber wants to stop recurring charges. " +
        "Do not use if the subscription is already inactive — check status first with liqpay_get_payment_status. " +
        "Returns { status: string }.",
      inputSchema: {
        order_id: z.string().min(1).describe("Subscription order ID (e.g. 'sub-2026-001')"),
      },
      outputSchema: {
        status: z.string().describe("Cancellation result (e.g. unsubscribed, error)"),
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
        const result = await client.request<LiqPayResponse>({ action: "unsubscribe", order_id });

        const output = { status: result.status };

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
