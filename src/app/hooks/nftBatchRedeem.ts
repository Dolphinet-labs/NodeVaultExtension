import { useCallback, useEffect, useMemo, useState } from "react";

import { storage } from "lib/ext/storage";

import { AccountNFT, AccountToken, TokenType } from "core/types";
import { parseTokenSlug } from "core/common/tokens";

import { redeemCacheKey } from "app/hooks/redeem";

export type BatchRedeemToken = {
  contract: string;
  tokenId: string;
  title?: string;
};

/**
 * Shared multi-select state for batch NFT redeem
 * (used by both the popup and the full-page token lists).
 *
 * Tokens that already have a cached redeem status are excluded
 * from selection via `redeemDisabledSlugs`.
 */
export function useNftBatchRedeem({
  tokens,
  isNftsSelected,
  suspended = false,
}: {
  tokens: AccountToken[];
  isNftsSelected: boolean;
  suspended?: boolean;
}) {
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedTokenSlugs, setSelectedTokenSlugs] = useState<string[]>([]);
  const [batchRedeemOpened, setBatchRedeemOpened] = useState(false);
  const [redeemDisabledSlugs, setRedeemDisabledSlugs] = useState<Set<string>>(
    () => new Set(),
  );

  const selectedTokens = useMemo(
    () =>
      tokens.filter(
        (token): token is AccountNFT =>
          token.tokenType === TokenType.NFT &&
          selectedTokenSlugs.includes(token.tokenSlug),
      ),
    [tokens, selectedTokenSlugs],
  );

  useEffect(() => {
    if (!multiSelectEnabled || !isNftsSelected) {
      setRedeemDisabledSlugs(new Set());
      return;
    }

    let cancelled = false;

    (async () => {
      const nftTokens = tokens.filter(
        (token): token is AccountNFT => token.tokenType === TokenType.NFT,
      );
      const keys = nftTokens.map((token) => {
        const { address } = parseTokenSlug(token.tokenSlug);
        return redeemCacheKey(token.chainId, address, token.tokenId);
      });
      const cached = await storage.fetchMany<{ status?: string }>(keys);
      if (cancelled) return;
      const next = new Set<string>();
      cached.forEach((val, idx) => {
        if (val?.status) {
          next.add(nftTokens[idx].tokenSlug);
        }
      });
      setRedeemDisabledSlugs(next);
    })().catch(() => {
      if (!cancelled) setRedeemDisabledSlugs(new Set());
    });

    return () => {
      cancelled = true;
    };
  }, [multiSelectEnabled, isNftsSelected, tokens]);

  const redeemTokens = useMemo<BatchRedeemToken[]>(
    () =>
      selectedTokens.map((token) => {
        const { address } = parseTokenSlug(token.tokenSlug);
        return {
          contract: address,
          tokenId: token.tokenId,
          title: token.name ?? token.tokenId,
        };
      }),
    [selectedTokens],
  );

  useEffect(() => {
    if (!isNftsSelected || suspended) {
      setMultiSelectEnabled(false);
      setSelectedTokenSlugs([]);
    }
  }, [isNftsSelected, suspended]);

  const toggleMultiSelect = useCallback(() => {
    setMultiSelectEnabled((prev) => !prev);
    setSelectedTokenSlugs([]);
  }, []);

  const toggleSelect = useCallback((tokenSlug: string) => {
    setSelectedTokenSlugs((prev) =>
      prev.includes(tokenSlug)
        ? prev.filter((slug) => slug !== tokenSlug)
        : [...prev, tokenSlug],
    );
  }, []);

  return {
    multiSelectEnabled,
    toggleMultiSelect,
    selectedTokenSlugs,
    selectedTokens,
    redeemTokens,
    redeemDisabledSlugs,
    toggleSelect,
    batchRedeemOpened,
    setBatchRedeemOpened,
  };
}
