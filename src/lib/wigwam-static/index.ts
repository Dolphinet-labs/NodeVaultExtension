import { IPFS_IO_GATEWAY } from "lib/nft-metadata/defaults";
import { getIPFSUrl } from "lib/nft-metadata/uri";
import { joinPath } from "lib/system/url";

const staticBaseUrl =
  typeof process !== "undefined" ? process.env.WIGWAM_STATIC_CDN : undefined;

export function wrapStaticUrl(originUrl: string) {
  if (!staticBaseUrl) return originUrl;

  const url = new URL(staticBaseUrl);

  // Already wrapped
  if (new URL(originUrl).origin === url.origin) return originUrl;

  url.pathname = originUrl;

  return url.toString();
}

export function getERC20IconUrl(chainId: number, tokenAddress: string) {
  // Dolphinet mainnet ERC20 icons are hosted in the NodeVault repo under:
  // iconassets/{tokenAddress}/logo.png
  // Use GitHub Raw so we can fetch the PNG directly.
  if (chainId === 1520) {
    const addr = tokenAddress.toLowerCase();
    return `https://raw.githubusercontent.com/Dolphinet-labs/NodeVault/main/iconassets/${addr}/logo.png`;
  }

  if (!staticBaseUrl) return null;

  return joinPath(staticBaseUrl, `token-icons/${chainId}/${tokenAddress}.png`);
}

export function wrapIpfsNetIcon(iconUrl: string) {
  return wrapStaticUrl(getIPFSUrl(iconUrl, IPFS_IO_GATEWAY));
}
