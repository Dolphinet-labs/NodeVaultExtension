import { useCallback, useEffect, useMemo, useState } from "react";

import { storage } from "lib/ext/storage";

import { redeemGetStatus } from "app/api/redeem";

export type RedeemStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "returning";

type CacheValue = {
  status: RedeemStatus;
  updatedAt: number;
};

const VALID_STATUSES: RedeemStatus[] = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "returning",
];

function isRedeemStatus(s: string): s is RedeemStatus {
  return (VALID_STATUSES as string[]).includes(s);
}

function cacheKey(chainId: number, contract: string, tokenId: string) {
  return `redeem_${chainId}_${contract.toLowerCase()}_${tokenId}`;
}

export function useRedeemStatus(input?: {
  chainId: number;
  contract: string;
  tokenId: string;
}) {
  const [status, setStatus] = useState<RedeemStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const key = useMemo(() => {
    if (!input?.chainId || !input?.contract || !input?.tokenId) return null;
    return cacheKey(input.chainId, input.contract, input.tokenId);
  }, [input?.chainId, input?.contract, input?.tokenId]);

  const setCachedStatus = useCallback(
    async (next: RedeemStatus) => {
      if (!input) return;
      const k = cacheKey(input.chainId, input.contract, input.tokenId);
      const val: CacheValue = { status: next, updatedAt: Date.now() };
      await storage.put(k, val);
      setStatus(next);
    },
    [input],
  );

  const refresh = useCallback(async () => {
    if (!input || !key) return;
    setLoading(true);
    try {
      const res = await redeemGetStatus(input);
      if ("message" in res) return;
      if (res.redeemed && res.status) {
        if (isRedeemStatus(res.status)) {
          await storage.put(key, {
            status: res.status,
            updatedAt: Date.now(),
          } satisfies CacheValue);
          setStatus(res.status);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [input, key]);

  useEffect(() => {
    let mounted = true;
    if (!key) return;

    (async () => {
      const cached = await storage.fetchForce<CacheValue>(key);
      if (mounted && cached?.status) setStatus(cached.status);
      await refresh();
    })().catch(() => {
      // ignore
    });

    return () => {
      mounted = false;
    };
  }, [key, refresh]);

  return { status, loading, refresh, setCachedStatus };
}


