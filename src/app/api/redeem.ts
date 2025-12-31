export type RedeemTokenKey = {
  chainId: number;
  contract: string;
  tokenId: string;
  walletAddress: string;
};

export type RedeemNonceResponse = {
  nonce: string;
  messageToSign: string;
  expiresAt: string;
};

export type RedeemShipping = {
  name: string;
  address: string;
  phone: string;
  email: string;
  note?: string | null;
};

export type RedeemSubmitResponse =
  | { ok: true; alreadyRedeemed?: boolean; status?: string }
  | { message: string };

export type RedeemStatusResponse =
  | { redeemed: boolean; status: string | null }
  | { message: string };

function getRedeemApiOrigin() {
  const origin = (process.env.REDEEM_API_ORIGIN ??
    "https://redeem.dolphinode.world") as string;
  return origin.replace(/\/+$/, "");
}

async function fetchJson<T>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getRedeemApiOrigin()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as any) : null;

    if (!res.ok) {
      const message =
        (json && typeof json.message === "string" && json.message) ||
        res.statusText ||
        "Request failed";
      throw new Error(message);
    }

    return json as T;
  } finally {
    clearTimeout(t);
  }
}

async function fetchGetJson<T>(path: string, opts?: { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${getRedeemApiOrigin()}${path}`, {
      method: "GET",
      signal: controller.signal,
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as any) : null;

    if (!res.ok) {
      const message =
        (json && typeof json.message === "string" && json.message) ||
        res.statusText ||
        "Request failed";
      throw new Error(message);
    }

    return json as T;
  } finally {
    clearTimeout(t);
  }
}

export async function redeemGetNonce(input: RedeemTokenKey) {
  const { chainId, contract, tokenId, walletAddress } = input;
  return fetchJson<RedeemNonceResponse>("/api/redeem/nonce", {
    chainId,
    contract,
    tokenId,
    walletAddress,
  });
}

export async function redeemSubmit(input: {
  token: RedeemTokenKey;
  nonce: string;
  message: string;
  signature: string;
  shipping: RedeemShipping;
}) {
  const { token, nonce, message, signature, shipping } = input;
  return fetchJson<RedeemSubmitResponse>("/api/redeem/submit", {
    chainId: token.chainId,
    contract: token.contract,
    tokenId: token.tokenId,
    walletAddress: token.walletAddress,
    nonce,
    message,
    signature,
    shipping,
  });
}

export async function redeemGetStatus(input: {
  chainId: number;
  contract: string;
  tokenId: string;
}) {
  const { chainId, contract, tokenId } = input;

  const qs = new URLSearchParams({
    chainId: String(chainId),
    contract,
    tokenId,
  });

  return fetchGetJson<RedeemStatusResponse>(`/api/redeem/status?${qs.toString()}`);
}
