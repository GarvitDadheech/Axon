export type MetricsSnapshot = {
  endpoints: Record<
    string,
    {
      requests: number;
      paidRequests: number;
      revenueUsdc: number;
    }
  >;
  totalUsdcSpent: number;
  totalApiCalls: number;
};

type EndpointKey = string;

export function createMetricsStore() {
  const endpoints = new Map<
    EndpointKey,
    { requests: number; paidRequests: number; revenueUsdc: number }
  >();

  function ensure(key: EndpointKey) {
    const existing = endpoints.get(key);
    if (existing) return existing;
    const fresh = { requests: 0, paidRequests: 0, revenueUsdc: 0 };
    endpoints.set(key, fresh);
    return fresh;
  }

  return {
    recordRequest(key: EndpointKey) {
      ensure(key).requests += 1;
    },
    recordPaid(key: EndpointKey, priceHuman: string) {
      const e = ensure(key);
      e.paidRequests += 1;
      const n = Number(priceHuman);
      e.revenueUsdc += Number.isFinite(n) ? n : 0;
    },
    snapshot(): MetricsSnapshot {
      const obj: MetricsSnapshot["endpoints"] = {};
      let totalUsdcSpent = 0;
      let totalApiCalls = 0;
      for (const [k, v] of endpoints.entries()) {
        obj[k] = { ...v };
        totalUsdcSpent += v.revenueUsdc;
        totalApiCalls += v.paidRequests;
      }
      return { endpoints: obj, totalUsdcSpent, totalApiCalls };
    }
  };
}

