import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LiqPayClient } from "../client.js";
import type { LiqPayReportsResponse } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function registerReportTools(server: McpServer, client: LiqPayClient): void {
  server.registerTool(
    "liqpay_get_payments_list",
    {
      title: "Get LiqPay Payments List",
      description:
        "Retrieve a list of payments filtered by date range (action: reports). " +
        "Use when reviewing transaction history for a specific period (max 31 days). " +
        "Do not use for a single payment — use liqpay_get_payment_status instead. " +
        "Returns { count, data: Payment[] }.",
      inputSchema: {
        date_from: z.number().int().positive().describe("Start of date range as Unix timestamp in ms (e.g. 1716768000000)"),
        date_to: z.number().int().positive().describe("End of date range as Unix timestamp in ms (max 31 days from date_from)"),
        status: z.string().optional().describe("Filter by payment status (e.g. 'success', 'failure', 'reversed')"),
      },
      outputSchema: {
        count: z.number().describe("Total number of payments in the result"),
        data: z.array(z.record(z.unknown())).describe("Array of payment records"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ date_from, date_to, status }) => {
      try {
        const params: Record<string, unknown> = { action: "reports", date_from, date_to };
        if (status) params["status"] = status;

        const result = await client.request<LiqPayReportsResponse>(params);

        const output = {
          count: result.count ?? result.data?.length ?? 0,
          data: result.data ?? [],
        };

        let text = JSON.stringify(output, null, 2);
        if (text.length > CHARACTER_LIMIT) {
          const truncated = output.data.slice(0, Math.ceil(output.data.length / 2));
          const truncatedOutput = { count: output.count, data: truncated, truncated: true, truncation_message: `Response truncated from ${output.data.length} to ${truncated.length} records. Narrow the date range or add a status filter.` };
          text = JSON.stringify(truncatedOutput, null, 2);
          return {
            content: [{ type: "text" as const, text }],
            structuredContent: truncatedOutput,
          };
        }

        return {
          content: [{ type: "text" as const, text }],
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
