export function formatLiqPayError(errCode: string | undefined, errDescription: string | undefined): string {
  if (!errCode) {
    return "Error: LiqPay returned an unexpected error. Retry the request or check the order_id.";
  }

  const base = `Error [${errCode}]: ${errDescription ?? "Unknown error"}`;

  switch (errCode) {
    case "err_auth":
      return `${base}. Check that LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY are correct.`;
    case "err_payment":
      return `${base}. The payment could not be processed — verify amount, currency, and card details.`;
    case "err_limit":
      return `${base}. Transaction limit exceeded — try a smaller amount or contact LiqPay support.`;
    case "err_signature":
      return `${base}. Signature mismatch — this usually means the private key is wrong.`;
    case "err_shop_not_active":
      return `${base}. The merchant account is not active — check your LiqPay dashboard.`;
    case "err_order_id":
      return `${base}. Invalid or duplicate order_id — use a unique identifier for each transaction.`;
    case "err_refund":
      return `${base}. Refund failed — ensure the original payment status is 'success' and the amount does not exceed the original.`;
    default:
      return `${base}. See LiqPay documentation for error code '${errCode}'.`;
  }
}

export function formatHttpError(status: number): string {
  switch (status) {
    case 401:
      return "Error: Authentication failed. Check LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY.";
    case 403:
      return "Error: Access denied. Your merchant account may lack permissions for this action.";
    case 429:
      return "Error: Rate limit exceeded. Wait before making more requests.";
    case 500:
    case 502:
    case 503:
      return `Error: LiqPay server error (HTTP ${status}). Retry after a short delay.`;
    default:
      return `Error: LiqPay API returned HTTP ${status}.`;
  }
}
