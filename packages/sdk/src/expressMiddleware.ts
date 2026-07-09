import type { Request, Response, NextFunction } from "express";
import {
  DEFAULT_QUOTE_TTL_SECONDS,
  PAYMENT_REFERENCE_HEADER,
  PAYMENT_TX_HEADER
} from "./constants.js";
import { createQuote, isQuoteExpired } from "./quote.js";
import { createInMemoryReplayStore } from "./replayStore.js";
import { verifyPayment } from "./verifyPayment.js";
import type { PaymentMiddlewareOptions, PaymentQuote } from "./types.js";

type QuoteStore = {
  get(reference: string): PaymentQuote | undefined;
  set(reference: string, quote: PaymentQuote): void;
  delete(reference: string): void;
};

function createInMemoryQuoteStore(): QuoteStore {
  const m = new Map<string, PaymentQuote>();
  return {
    get(reference) {
      return m.get(reference);
    },
    set(reference, quote) {
      m.set(reference, quote);
    },
    delete(reference) {
      m.delete(reference);
    }
  };
}

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function paymentMiddleware(options: PaymentMiddlewareOptions) {
  const quoteTtlSeconds = options.quoteTtlSeconds ?? DEFAULT_QUOTE_TTL_SECONDS;
  const getNow = options.getNow ?? (() => new Date());
  const tokenAddress = options.tokenAddress;

  const quoteStore = createInMemoryQuoteStore();
  const replayStore = options.replayStore ?? createInMemoryReplayStore();

  return async function middleware(req: Request, res: Response, next: NextFunction) {
    try {
      const path = normalizePath(req.path);
      const pricing = options.routes[path];
      if (!pricing) return next();

      const keyMethod = String(req.method || "GET").toUpperCase();
      const keyEndpoint = path;

      const paymentTx = req.header(PAYMENT_TX_HEADER);
      const paymentRef = req.header(PAYMENT_REFERENCE_HEADER);

      if (!paymentTx || !paymentRef) {
        const quote = createQuote({
          endpoint: keyEndpoint,
          method: keyMethod,
          pricing,
          receiverAddress: options.receiverAddress,
          tokenAddress,
          ttlSeconds: quoteTtlSeconds,
          now: getNow()
        });
        quoteStore.set(quote.reference, quote);

        res.status(402);
        res.setHeader("content-type", "application/json");
        res.setHeader("www-authenticate", `x402 token=\"${quote.token}\", price=\"${quote.price}\"`);
        return res.send(JSON.stringify(quote));
      }

      const storedQuote = quoteStore.get(paymentRef);
      if (!storedQuote) {
        res.status(402);
        return res.json({ reason: "Unknown payment reference" });
      }

      const now = getNow();
      if (isQuoteExpired(storedQuote, now)) {
        quoteStore.delete(paymentRef);
        res.status(402);
        return res.json({ reason: "Quote expired" });
      }

      if (storedQuote.endpoint !== keyEndpoint || storedQuote.method !== keyMethod) {
        res.status(402);
        return res.json({ reason: "Quote mismatch" });
      }

      if (replayStore.has(paymentTx)) {
        res.status(409);
        return res.json({ reason: "Replay detected" });
      }

      const result = await verifyPayment({
        rpcUrl: options.rpcUrl,
        receiverAddress: options.receiverAddress,
        tokenAddress,
        input: { quote: storedQuote, txSig: paymentTx },
        requireMemoReference: true
      });

      if (!result.ok) {
        res.status(402);
        return res.json({ reason: result.reason });
      }

      replayStore.add(paymentTx);
      quoteStore.delete(paymentRef);

      options.onPaid?.({
        endpoint: storedQuote.endpoint,
        method: storedQuote.method,
        price: storedQuote.price,
        token: storedQuote.token,
        receiver: storedQuote.receiver,
        tokenAddress: storedQuote.tokenAddress,
        reference: storedQuote.reference,
        txSig: paymentTx,
        paidAt: now.toISOString()
      });

      // Inject x402Tnx into the JSON response body
      const x402Tnx = { tnxHash: paymentTx, amount: Number(storedQuote.price), token: storedQuote.token };
      const originalJson = res.json.bind(res);
      res.json = function (data: unknown) {
        const patched = data !== null && typeof data === "object"
          ? { ...(data as object), x402Tnx }
          : data;
        return originalJson(patched);
      };

      return next();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500);
      return res.json({ error: msg });
    }
  };
}

