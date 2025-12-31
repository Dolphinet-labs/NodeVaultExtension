import { wrapIpfsNetIcon } from "lib/wigwam-static";

import { mergeNetworkUrls } from "core/common";
import { Network } from "core/types";
import { getAllEvmNetworks } from "core/common/chainList";

import { DEFAULT_NETWORKS } from "fixtures/networks";

import { db } from "./schema";
import { networks } from "./helpers";

let setupFixturesPromise: Promise<void> | null = null;

export async function setupFixtures() {
  if (setupFixturesPromise) return setupFixturesPromise;

  setupFixturesPromise = (async () => {
    try {
      await db.transaction("rw", networks, async () => {
        const existingNetworks = await networks.toArray();

        const extNetsMap = new Map(existingNetworks.map((n) => [n.chainId, n]));
        const mainNets: Network[] = [];

        for (const net of DEFAULT_NETWORKS) {
          const existing = extNetsMap.get(net.chainId);

          mainNets.push(existing ? mergeNetwork(existing, net) : net);

          if (existing) extNetsMap.delete(net.chainId);
        }

        await networks.bulkPut(mainNets);

        if (process.env.NODE_ENV === "test") return;

        // Fetch the extended chain list (best-effort). We intentionally do this
        // AFTER seeding DEFAULT_NETWORKS so the Networks screen is never empty
        // on first startup due to a slow/failing API call.
        const allEvmNetworks = await getAllEvmNetworks().catch(() => []);

        // Refresh rest
        const allNetsMap = new Map(allEvmNetworks.map((n) => [n.chainId, n]));

        const restNets = Array.from(extNetsMap.values()).map((net) => {
          const evmData = allNetsMap.get(net.chainId);

          // Localhost
          if (net.chainId === 1337) return net;

          // Manually changed
          // TODO: Better to merge
          if (net.manuallyChanged) return net;

          return evmData
            ? mergeNetwork(net, {
                chainId: evmData.chainId,
                type: evmData.testnet ? "testnet" : "unknown",
                chainTag: "",
                rpcUrls: evmData.rpcUrls.filter((url) =>
                  url.startsWith("http"),
                ),
                name: evmData.name,
                nativeCurrency: evmData.nativeCurrency,
                explorerUrls: evmData.explorers?.map((exp) => exp.url),
                explorerApiUrl: evmData.explorers?.find((exp) => exp.apiUrl)
                  ?.apiUrl,
                faucetUrls: evmData.faucets,
                iconUrls: evmData.icon && [wrapIpfsNetIcon(evmData.icon.url)],
                infoUrl: evmData.infoUrl,
                position: 0,
              })
            : net;
        });

        await networks.bulkPut(restNets);
      });
    } catch (err) {
      // Avoid noisy logs in production; this is best-effort and defaults are seeded above.
      if (process.env.NODE_ENV !== "production") {
        console.error("[setupFixtures] failed", err);
      }
    } finally {
      // Allow re-run if needed (e.g. after a DB reset).
      setupFixturesPromise = null;
    }
  })();

  return setupFixturesPromise;
}

function mergeNetwork(saved: Network, toMerge: Network): Network {
  return {
    ...saved,
    // Override
    ...toMerge,
    // Merge
    rpcUrls: mergeNetworkUrls(saved.rpcUrls, toMerge.rpcUrls)!,
    explorerUrls: mergeNetworkUrls(saved.explorerUrls, toMerge.explorerUrls),
  };
}
