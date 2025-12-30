import { TokenType } from "core/types";
import { getNetwork } from "core/common/network";

import { syncAccountAssets } from "./assets";
import { syncAccountNFTs } from "./nfts";

export async function syncAccountTokens(
  tokenType: TokenType,
  chainId: number,
  accountAddress: string,
) {
  const net = await getNetwork(chainId).catch(() => null);
  const isDolphinet = net?.chainTag === "dolphinet";

  // Dolphinet UX: keep both ERC20 & NFTs in sync regardless of the currently opened tab.
  if (isDolphinet) {
    await Promise.allSettled([
      syncAccountAssets(chainId, accountAddress),
      syncAccountNFTs(chainId, accountAddress),
    ]);
    return;
  }

  const sync =
    tokenType === TokenType.Asset ? syncAccountAssets : syncAccountNFTs;

  await sync(chainId, accountAddress);
}
