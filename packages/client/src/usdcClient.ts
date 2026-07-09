import { PAYMENT_TX_HEADER, PAYMENT_REFERENCE_HEADER } from "./constants.js";
import type { UsdcClientConfig, Payer, Quote } from "./types.js";

export class UsdcClient {
  private payer: Payer;

  constructor(config: UsdcClientConfig) {
    this.payer = config.payer;
  }

  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    const firstRes = await globalThis.fetch(url, init);
    if (firstRes.status !== 402) return firstRes;

    const quote = (await firstRes.json()) as Quote;
    const txSig = await this.payer(quote);

    return globalThis.fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        [PAYMENT_TX_HEADER]: txSig,
        [PAYMENT_REFERENCE_HEADER]: quote.reference
      }
    });
  }
}

export function createUsdcClient(config: UsdcClientConfig): UsdcClient {
  return new UsdcClient(config);
}
