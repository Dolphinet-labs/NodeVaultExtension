import { GasPrices } from "core/types";

import { indexerApi } from "../indexer";

const BLOCKLIST_CHAINIDS = [534352];

export async function getIndexerGasPrices(chainId: number): Promise<GasPrices> {
  if (BLOCKLIST_CHAINIDS.includes(chainId)) return null;
  if (!process.env.WIGWAM_INDEXER_API || !process.env.WIGWAM_INDEXER_API_KEY) {
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
