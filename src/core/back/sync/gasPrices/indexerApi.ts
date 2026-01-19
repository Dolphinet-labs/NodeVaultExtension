import { GasPrices } from "core/types";

import { indexerApi } from "../indexer";

const BLOCKLIST_CHAINIDS = [534352];
const WIGWAM_INDEXER_API =
  typeof process !== "undefined" ? process.env.WIGWAM_INDEXER_API : "";
const WIGWAM_INDEXER_API_KEY =
  typeof process !== "undefined" ? process.env.WIGWAM_INDEXER_API_KEY : "";

export async function getIndexerGasPrices(chainId: number): Promise<GasPrices> {
  if (BLOCKLIST_CHAINIDS.includes(chainId)) return null;
  if (!WIGWAM_INDEXER_API || !WIGWAM_INDEXER_API_KEY) {
    return null;
  }

  const { data } = await indexerApi
    .get<GasPrices>(`/gasprices/${chainId}`, {
      headers: {
        "Cache-Control": "no-cache",
      },
    })
    .catch(() => ({ data: null as any }));

  return data;
}
