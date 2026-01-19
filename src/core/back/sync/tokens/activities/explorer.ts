import { getAddress } from "ethers";
import BigNumber from "bignumber.js";
import axios from "axios";
import { createQueue } from "lib/system/queue";

import { AccountToken, TokenStandard, TokenType } from "core/types";
import { NATIVE_TOKEN_SLUG, parseTokenSlug } from "core/common/tokens";
import { getNetwork } from "core/common/network";

import {
  fetchAddressTokenTransfers,
  fetchAddressTransactions,
  isBlockscoutV2ApiUrl,
} from "../../explorer/blockscoutV2";
import { getLatestTokenActivity, prepareTokenActivitiesRepo } from "./utils";

/**
 * Explorer (etherscan) Token Activities sync
 * For ERC20 tokens, For NFTS, and for native token as default 'txlist'
 */
export async function syncExplorerTokenActivities(token: AccountToken) {
  const { chainId, tokenSlug, accountAddress, tokenType } = token;

  const { explorerApiUrl } = await getNetwork(chainId);
  if (!explorerApiUrl) return;

  const nativeToken = tokenSlug === NATIVE_TOKEN_SLUG;
  const {
    standard,
    address: tokenAddress,
    id: tokenId,
  } = parseTokenSlug(tokenSlug);

  const latestItem = await getLatestTokenActivity(token);

  // Blockscout v2 mode
  if (isBlockscoutV2ApiUrl(explorerApiUrl)) {
    const { addToActivities, releaseToRepo } = prepareTokenActivitiesRepo();

    const base = {
      chainId,
      accountAddress,
      tokenSlug,
      pending: 0,
    };

    if (nativeToken) {
      const txs = await fetchAddressTransactions(
        explorerApiUrl,
        accountAddress,
      );
      for (const tx of txs) {
        const timeAt = Date.parse(tx.timestamp);
        if (!Number.isFinite(timeAt)) continue;
        if (latestItem && latestItem.timeAt >= timeAt) break;

        if (!tx.value || tx.value === "0") continue;
        if (!tx.from || !tx.to) continue;

        const from = typeof tx.from === "string" ? tx.from : tx.from.hash;
        const to = typeof tx.to === "string" ? tx.to : tx.to.hash;
        if (!from || !to) continue;

        const income = accountAddress.toLowerCase() === to.toLowerCase();

        addToActivities({
          ...base,
          timeAt,
          txHash: tx.hash,
          type: "transfer",
          anotherAddress: income ? from : to,
          amount: (BigInt(tx.value) * (income ? 1n : -1n)).toString(),
        });
      }

      await releaseToRepo();
      return true;
    }

    const transfers = await fetchAddressTokenTransfers({
      baseURL: explorerApiUrl,
      address: accountAddress,
      token: tokenAddress,
      type:
        standard === TokenStandard.ERC20
          ? "ERC-20"
          : standard === TokenStandard.ERC721
            ? "ERC-721"
            : "ERC-1155",
    });

    for (const t of transfers) {
      const timeAt = Date.parse(t.timestamp ?? "");
      if (!Number.isFinite(timeAt)) continue;
      if (latestItem && latestItem.timeAt >= timeAt) break;

      const from = typeof t.from === "string" ? t.from : t.from.hash;
      const to = typeof t.to === "string" ? t.to : t.to.hash;
      if (!from || !to) continue;

      // Filter exact token id for NFT
      if (tokenType === TokenType.NFT) {
        const total: any = t.total as any;
        const transferTokenId: string | undefined = total?.token_id;
        if (transferTokenId && transferTokenId !== tokenId) continue;
      }

      const income = accountAddress.toLowerCase() === to.toLowerCase();

      const total: any = t.total as any;
      const value: string = total?.value ?? "1";

      if (value === "0") continue;

      addToActivities({
        ...base,
        timeAt,
        txHash: t.transaction_hash,
        type: "transfer",
        anotherAddress: income ? from : to,
        amount: (BigInt(value) * (income ? 1n : -1n)).toString(),
      });
    }

    await releaseToRepo();
    return true;
  }

  const action = (() => {
    if (nativeToken) return "txlist";
    if (standard === TokenStandard.ERC721) return "tokennfttx";
    if (standard === TokenStandard.ERC1155) return "token1155tx";

    return "tokentx"; // For ERC20
  })();

  const { data } = await withExplorerApiRequest(() =>
    axios({
      baseURL: explorerApiUrl,
      params: {
        module: "account",
        action,
        ...(nativeToken ? {} : { contractaddress: tokenAddress }),
        address: accountAddress,
        sort: "desc",
        page: 1,
        offset: 500,
      },
    }).then((res) => {
      if (res.data?.message === "NOTOK") {
        throw new Error(res.data.result);
      }

      return res;
    }),
  );

  let txs = data.result;

  if (!txs || txs.length === 0) return true;

  if (tokenType === TokenType.NFT) {
    txs = txs.filter((t: any) => t.tokenID === tokenId);
  }

  const { addToActivities, releaseToRepo } = prepareTokenActivitiesRepo();

  const base = {
    chainId,
    accountAddress,
    tokenSlug,
    pending: 0,
  };

  for (const tx of txs) {
    const timeAt = new BigNumber(tx.timeStamp).times(1_000).toNumber();

    if (latestItem && latestItem.timeAt >= timeAt) {
      break;
    }

    if (tx.value === "0" || tx.blockHash === "" || tx.isError === "1") {
      continue;
    }

    const [fromAddress, toAddress] = [tx.from, tx.to].map(
      (a) => a && getAddress(a),
    );
    if (!fromAddress || !toAddress) continue;

    const income = accountAddress === toAddress;
    const value = tx.value || tx.tokenValue || "1";

    addToActivities({
      ...base,
      timeAt,
      txHash: tx.hash,
      type: "transfer",
      anotherAddress: income ? fromAddress : toAddress,
      amount: (BigInt(value) * (income ? 1n : -1n)).toString(),
    });
  }

  await releaseToRepo();

  return true;
}

const enqueueExplorerApiRequest = createQueue();
let explorerApiLimitTime: number | undefined;

function withExplorerApiRequest<T>(factory: () => Promise<T>) {
  return enqueueExplorerApiRequest(async () => {
    if (explorerApiLimitTime) {
      await new Promise((res) =>
        setTimeout(res, explorerApiLimitTime! - Date.now()),
      );
    }

    return factory().finally(() => {
      explorerApiLimitTime = Date.now() + 5_000;
    });
  });
}
