import axios, { AxiosInstance } from "axios";
import { createQueue } from "lib/system/queue";

type NextPageParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type BlockscoutV2Page<TItem> = {
  items: TItem[];
  next_page_params?: NextPageParams | null;
};

export type BlockscoutV2TokenInfo = {
  address_hash: string;
  name?: string;
  symbol?: string;
  decimals?: string;
  type?: string; // "ERC-20" | "ERC-721" | "ERC-1155" | ...
  exchange_rate?: string;
};

export type BlockscoutV2TokenBalance = {
  value: string;
  token_id?: string;
  token: BlockscoutV2TokenInfo;
};

export type BlockscoutV2TotalERC20 = {
  decimals: string;
  value: string;
};
export type BlockscoutV2TotalERC721 = {
  token_id: string;
};
export type BlockscoutV2TotalERC1155 = {
  token_id: string;
  decimals?: string | null;
  value: string;
};

export type BlockscoutV2TokenTransfer = {
  token_type: "ERC-20" | "ERC-721" | "ERC-1155" | "ERC-404";
  timestamp?: string;
  from: { hash: string } | string;
  to: { hash: string } | string;
  token: BlockscoutV2TokenInfo;
  total:
    | BlockscoutV2TotalERC20
    | BlockscoutV2TotalERC721
    | BlockscoutV2TotalERC1155;
  transaction_hash: string;
};

export type BlockscoutV2Transaction = {
  timestamp: string;
  hash: string;
  from: { hash: string } | string;
  to: { hash: string } | string | null;
  value: string;
  status?: string;
};

export type BlockscoutV2NftInstance = {
  id: string; // token id
  token_type: string; // "ERC-721" | "ERC-1155" | ...
  value: string; // balance/count
  image_url?: string;
  animation_url?: string;
  external_app_url?: string;
  metadata?: any;
};

export type BlockscoutV2NftCollection = {
  token: BlockscoutV2TokenInfo;
  amount?: string;
  token_instances: BlockscoutV2NftInstance[];
};

const apiCache = new Map<string, AxiosInstance>();
const queueCache = new Map<string, ReturnType<typeof createQueue>>();
const apiLimitTime = new Map<string, number>();

function getQueue(baseURL: string) {
  let q = queueCache.get(baseURL);
  if (!q) {
    q = createQueue();
    queueCache.set(baseURL, q);
  }
  return q;
}

function getApi(baseURL: string) {
  let api = apiCache.get(baseURL);
  if (!api) {
    api = axios.create({
      baseURL,
      timeout: 45_000,
    });
    apiCache.set(baseURL, api);
  }
  return api;
}

export function isBlockscoutV2ApiUrl(url?: string) {
  if (!url) return false;
  return /\/api\/v2\/?$/.test(url);
}

async function withRateLimit<T>(baseURL: string, fn: () => Promise<T>) {
  const q = getQueue(baseURL);
  return q(async () => {
    const limitTime = apiLimitTime.get(baseURL);
    if (limitTime) {
      await new Promise((r) =>
        setTimeout(r, Math.max(0, limitTime - Date.now())),
      );
    }

    return fn().finally(() => {
      // conservative: 1 req / 1s per baseURL
      apiLimitTime.set(baseURL, Date.now() + 1_000);
    });
  });
}

function normalizePageParams(params?: NextPageParams | null) {
  if (!params) return undefined;
  const next: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    next[k] = v;
  }
  return Object.keys(next).length ? next : undefined;
}

async function paginate<TItem>(opts: {
  baseURL: string;
  path: string;
  params?: Record<string, any>;
  maxPages?: number;
}): Promise<TItem[]> {
  const { baseURL, path, params, maxPages = 20 } = opts;
  const api = getApi(baseURL);

  const items: TItem[] = [];
  let pageParams: Record<string, any> | undefined = params;

  for (let i = 0; i < maxPages; i++) {
    const res = await withRateLimit(baseURL, async () =>
      api.get<BlockscoutV2Page<TItem>>(path, { params: pageParams }),
    );

    const data = res.data;
    if (data?.items?.length) items.push(...data.items);

    const next = normalizePageParams(data?.next_page_params);
    if (!next) break;
    pageParams = { ...(params ?? {}), ...next };
  }

  return items;
}

export async function fetchAddressTokenBalances(
  baseURL: string,
  address: string,
) {
  const api = getApi(baseURL);
  const res = await withRateLimit(baseURL, () =>
    api.get<BlockscoutV2TokenBalance[]>(`/addresses/${address}/token-balances`),
  );
  return res.data ?? [];
}

export async function fetchAddressNftCollections(
  baseURL: string,
  address: string,
) {
  return paginate<BlockscoutV2NftCollection>({
    baseURL,
    path: `/addresses/${address}/nft/collections`,
    params: {
      type: "ERC-721,ERC-1155",
    },
    maxPages: 50,
  });
}

export type BlockscoutV2AddressToken = {
  token: BlockscoutV2TokenInfo;
  amount?: string;
};

// Dolphinet explorers reliably support this endpoint; it's also used by alpha-wallet-android:
// /api/v2/addresses/:address/tokens?type=ERC-721
export async function fetchAddressTokens(
  baseURL: string,
  address: string,
  type: string,
) {
  const api = getApi(baseURL);
  const res = await withRateLimit(baseURL, () =>
    api.get<{ items?: BlockscoutV2AddressToken[] }>(
      `/addresses/${address}/tokens`,
      {
        params: { type },
      },
    ),
  );
  return res.data?.items ?? [];
}

// Dolphinet explorers expose token instances which include `owner.hash`, so we can filter by address.
export async function fetchTokenInstances(
  baseURL: string,
  tokenAddress: string,
) {
  const api = getApi(baseURL);
  const res = await withRateLimit(baseURL, () =>
    api.get<any>(`/tokens/${tokenAddress}/instances`),
  );

  const data = res.data;
  if (Array.isArray(data)) return data as BlockscoutV2NftInstance[];
  if (data && Array.isArray(data.items))
    return data.items as BlockscoutV2NftInstance[];

  return [];
}

export async function fetchAddressTokenTransfers(opts: {
  baseURL: string;
  address: string;
  token?: string;
  type?: string; // "ERC-20,ERC-721,ERC-1155"
}) {
  const { baseURL, address, token, type } = opts;

  return paginate<BlockscoutV2TokenTransfer>({
    baseURL,
    path: `/addresses/${address}/token-transfers`,
    params: {
      ...(type ? { type } : {}),
      ...(token ? { token } : {}),
    },
    maxPages: 20,
  });
}

export async function fetchAddressTransactions(
  baseURL: string,
  address: string,
) {
  return paginate<BlockscoutV2Transaction>({
    baseURL,
    path: `/addresses/${address}/transactions`,
    params: {},
    maxPages: 20,
  });
}
