import { Network } from "core/types";

export const DOLPHINET_MAINNET_CHAIN_ID = 1520;
export const DOLPHINET_TESTNET_CHAIN_ID = 1519;

export const DOLPHINET_CHAIN_IDS = new Set<number>([
  DOLPHINET_MAINNET_CHAIN_ID,
  DOLPHINET_TESTNET_CHAIN_ID,
]);

export function isDolphinetChainId(chainId?: number): boolean {
  return chainId !== undefined && DOLPHINET_CHAIN_IDS.has(chainId);
}

export const DOLPHINET_ICON =
  "https://explorer.dolphinode.world/assets/configs/network_icon.png";
export const DOLPHINET_TESTNET_ICON =
  "https://explorer-testnet.dolphinode.world/assets/configs/network_icon.png";

export const DOLPHINET: Network[] = [
  // Mainnet
  {
    chainId: DOLPHINET_MAINNET_CHAIN_ID,
    type: "mainnet",
    rpcUrls: [
      "https://rpc.dolphinode.world",
      "https://rpc-dev01.dolphinode.world",
    ],
    chainTag: "dolphinet",
    name: "Dolphinet",
    nativeCurrency: {
      symbol: "DOL",
      name: "Dolphinet",
      decimals: 18,
    },
    explorerUrls: ["https://explorer.dolphinode.world"],
    explorerApiUrl: "https://explorer.dolphinode.world/api/v2",
    iconUrls: [DOLPHINET_ICON],
    faucetUrls: [],
    infoUrl: "https://chain.dolphinode.world",
  },
  // Testnet
  {
    chainId: DOLPHINET_TESTNET_CHAIN_ID,
    type: "testnet",
    rpcUrls: ["https://rpc-testnet.dolphinode.world"],
    chainTag: "dolphinet",
    name: "Dolphinet Testnet",
    nativeCurrency: {
      symbol: "DOL",
      name: "Dolphinet",
      decimals: 18,
    },
    explorerUrls: ["https://explorer-testnet.dolphinode.world"],
    explorerApiUrl: "https://explorer-testnet.dolphinode.world/api/v2",
    iconUrls: [DOLPHINET_TESTNET_ICON],
    faucetUrls: [],
    infoUrl: "https://explorer-testnet.dolphinode.world",
  },
];
