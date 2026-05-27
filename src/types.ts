import type { LiqPayAction, LiqPayStatus, SupportedCurrency, SubscribePeriodicity } from "./constants.js";

export interface LiqPayBasePayload {
  version: number;
  public_key: string;
  action: LiqPayAction;
}

export interface LiqPayCheckoutPayload extends LiqPayBasePayload {
  action: "pay";
  amount: number;
  currency: SupportedCurrency;
  description: string;
  order_id: string;
  result_url?: string;
  server_url?: string;
  language?: "uk" | "en";
}

export interface LiqPayStatusPayload extends LiqPayBasePayload {
  action: "status";
  order_id: string;
}

export interface LiqPayHoldPayload extends LiqPayBasePayload {
  action: "hold";
  amount: number;
  currency: SupportedCurrency;
  description: string;
  order_id: string;
  card: string;
  card_exp_month: string;
  card_exp_year: string;
  card_cvv: string;
}

export interface LiqPayHoldCompletionPayload extends LiqPayBasePayload {
  action: "hold_completion";
  order_id: string;
  amount?: number;
}

export interface LiqPayRefundPayload extends LiqPayBasePayload {
  action: "refund";
  order_id: string;
  amount?: number;
}

export interface LiqPaySubscribePayload extends LiqPayBasePayload {
  action: "subscribe";
  amount: number;
  currency: SupportedCurrency;
  description: string;
  order_id: string;
  subscribe_date_start: string;
  subscribe_periodicity: SubscribePeriodicity;
  result_url?: string;
  server_url?: string;
}

export interface LiqPayUnsubscribePayload extends LiqPayBasePayload {
  action: "unsubscribe";
  order_id: string;
}

export interface LiqPayP2PPayload extends LiqPayBasePayload {
  action: "p2p";
  amount: number;
  currency: SupportedCurrency;
  description: string;
  order_id: string;
  card: string;
}

export interface LiqPayReportsPayload extends LiqPayBasePayload {
  action: "reports";
  date_from: number;
  date_to: number;
  status?: LiqPayStatus;
}

export interface LiqPayResponse {
  result: string;
  status: LiqPayStatus;
  payment_id?: number;
  action?: string;
  amount?: number;
  currency?: SupportedCurrency;
  description?: string;
  order_id?: string;
  create_date?: number;
  end_date?: number;
  transaction_id?: number;
  err_code?: string;
  err_description?: string;
}

export interface LiqPayReportsResponse {
  result: string;
  count: number;
  data: LiqPayResponse[];
}

export type LiqPayPayload =
  | LiqPayCheckoutPayload
  | LiqPayStatusPayload
  | LiqPayHoldPayload
  | LiqPayHoldCompletionPayload
  | LiqPayRefundPayload
  | LiqPaySubscribePayload
  | LiqPayUnsubscribePayload
  | LiqPayP2PPayload
  | LiqPayReportsPayload;
