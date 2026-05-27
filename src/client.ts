import { createSignature, encodeData } from "./auth.js";
import { LIQPAY_API_URL, LIQPAY_API_VERSION, LIQPAY_CHECKOUT_URL } from "./constants.js";
import { formatHttpError, formatLiqPayError } from "./errors.js";
import type { LiqPayResponse } from "./types.js";

export class LiqPayClient {
  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
  ) {}

  async request<T = LiqPayResponse>(params: Record<string, unknown>): Promise<T> {
    const payload = {
      ...params,
      version: LIQPAY_API_VERSION,
      public_key: this.publicKey,
    };

    const data = encodeData(payload);
    const signature = createSignature(data, this.privateKey);

    const response = await fetch(LIQPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data, signature }).toString(),
    });

    if (!response.ok) {
      throw new Error(formatHttpError(response.status));
    }

    const result = (await response.json()) as T & { err_code?: string; err_description?: string; status?: string };

    if (result.status === "error" || result.err_code) {
      throw new Error(formatLiqPayError(result.err_code, result.err_description));
    }

    return result;
  }

  buildCheckoutUrl(params: Record<string, unknown>): string {
    const payload = {
      ...params,
      version: LIQPAY_API_VERSION,
      public_key: this.publicKey,
    };

    const data = encodeData(payload);
    const signature = createSignature(data, this.privateKey);

    return `${LIQPAY_CHECKOUT_URL}?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;
  }
}
