export const LIQPAY_API_URL = "https://www.liqpay.ua/api/request";
export const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";
export const LIQPAY_API_VERSION = 3;

export const CHARACTER_LIMIT = 25000;

export const SUPPORTED_CURRENCIES = ["UAH", "USD", "EUR"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const LIQPAY_STATUSES = [
  "success",
  "failure",
  "error",
  "wait_accept",
  "processing",
  "reversed",
  "hold_wait",
  "sandbox",
  "subscribed",
  "unsubscribed",
] as const;
export type LiqPayStatus = (typeof LIQPAY_STATUSES)[number];

export const LIQPAY_ACTIONS = {
  PAY: "pay",
  HOLD: "hold",
  HOLD_COMPLETION: "hold_completion",
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
  REFUND: "refund",
  STATUS: "status",
  REPORTS: "reports",
  P2P: "p2p",
} as const;
export type LiqPayAction = (typeof LIQPAY_ACTIONS)[keyof typeof LIQPAY_ACTIONS];

export const SUBSCRIBE_PERIODICITIES = ["day", "week", "month", "year"] as const;
export type SubscribePeriodicity = (typeof SUBSCRIBE_PERIODICITIES)[number];
