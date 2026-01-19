import browser, { Runtime } from "webextension-polyfill";
import { nanoid } from "nanoid";
import { forEachSafe } from "lib/system/forEachSafe";

import { PorterMessageType } from "./types";
import {
  deserializeError,
  sanitizeMessage,
  PorterTimeoutError,
  PorterDisconnectedError,
} from "./helpers";

const DEFAULT_COLD_START_RETRY_TYPES = new Set<string>([
  // Safe, read-only requests that are frequently called at app start.
  "GET_WALLET_STATE",
  "GET_ACCOUNTS",
  "GET_APPROVALS",
  "GET_GAS_PRICES",
  "GET_SYNC_STATUS",
  "GET_ONRAMP_CURRENCIES",
  "GET_TOKEN_DETAILS_URL",
]);

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class PorterClient<ReqData = any, ResData = unknown> {
  private port?: Runtime.Port;
  private portId = nanoid();
  private reqId = 0;
  private messageHandlers = new Set<(msg: any) => void>();
  private lastConnectName?: string;

  public onFullyDisconnect?: () => void;

  connect(name: string, attempts = 0) {
    this.lastConnectName = name;
    this.port?.disconnect();

    const handleReconnect = (err?: any) => {
      if (attempts > 20 || err?.message === "Extension context invalidated.") {
        console.error(err);
        this.onFullyDisconnect?.();
        return;
      }

      setTimeout(
        () => this.connect(name, attempts + 1),
        attempts < 10 ? 100 : 1_000,
      );
    };

    let port: Runtime.Port;
    try {
      const nameWithId = `${name}_${this.portId}`;
      port = browser.runtime.connect({ name: nameWithId });
    } catch (err) {
      handleReconnect(err);
      console.error(err);
      return;
    }

    port.onMessage.addListener((msg) => {
      forEachSafe(this.messageHandlers, (handle) => handle(msg));
    });

    port.onDisconnect.addListener((p) => {
      delete this.port;

      const err = p.error ?? browser.runtime.lastError;
      handleReconnect(err);
    });

    this.port = port;
    attempts = 0;
  }

  /**
   * Makes a request to background process and returns a response promise
   */
  async request(
    data: ReqData,
    opts: { timeout?: number; signal?: AbortSignal } = {},
  ): Promise<ResData> {
    const type = (data as any)?.type;
    const shouldColdStartRetry =
      typeof type === "string" &&
      DEFAULT_COLD_START_RETRY_TYPES.has(type) &&
      // Don't retry "no-timeout" requests to avoid duplicated side effects / hangs.
      opts.timeout !== 0;

    const maxRetries = shouldColdStartRetry ? 2 : 0;
    const backoffMs = [150, 350, 800];

    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.requestOnce(data, opts);
      } catch (e) {
        lastErr = e;

        const retriable =
          e instanceof PorterTimeoutError ||
          e instanceof PorterDisconnectedError;

        if (!retriable || attempt >= maxRetries) {
          throw e;
        }

        // Best-effort reconnect before retrying (helps when Service Worker is waking).
        if (this.lastConnectName) {
          try {
            this.connect(this.lastConnectName);
          } catch (err) {
            // noop - next attempt will surface the real error if still failing.
            console.warn("porter reconnect failed", err);
          }
        }

        await delay(backoffMs[attempt] ?? 800);
      }
    }

    throw lastErr;
  }

  private async requestOnce(
    data: ReqData,
    opts: { timeout?: number; signal?: AbortSignal } = {},
  ): Promise<ResData> {
    const port = this.getCurrentPort();
    const reqId = this.reqId++;

    port.postMessage(
      sanitizeMessage({ type: PorterMessageType.Req, reqId, data }),
    );

    return new Promise((resolve, reject) => {
      const handleMessage = (msg: any) => {
        switch (true) {
          case msg?.reqId !== reqId:
            return;

          case msg?.type === PorterMessageType.Res:
            resolve(msg.data);
            break;

          case msg?.type === PorterMessageType.Err:
            reject(deserializeError(msg.data));
            break;

          default:
            break;
        }

        cleanup();
      };

      const handleDisconnect = () => {
        cleanup();
        reject(new PorterDisconnectedError());
      };

      const handleAbort = () => {
        cleanup();
        reject(new Error("Request cancelled"));
      };

      const handleTimeout = () => {
        cleanup();
        reject(new PorterTimeoutError());
      };

      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeoutId);
        opts.signal?.removeEventListener("abort", handleAbort);
        port.onDisconnect.removeListener(handleDisconnect);
        this.messageHandlers.delete(handleMessage);
      };

      this.messageHandlers.add(handleMessage);
      port.onDisconnect.addListener(handleDisconnect);
      opts.signal?.addEventListener("abort", handleAbort);
      if (opts.timeout !== 0) {
        timeoutId = setTimeout(handleTimeout, opts.timeout ?? 60_000);
      }
    });
  }

  sendOneWayMessage<T>(data: T) {
    const port = this.getCurrentPort();
    port.postMessage(sanitizeMessage({ type: PorterMessageType.OneWay, data }));
  }

  /**
   * Allows to subscribe to notifications channel from background process
   */
  onOneWayMessage<OneWayData = unknown>(callback: (data: OneWayData) => void) {
    const listener = (msg: any) => {
      if (msg?.type === PorterMessageType.OneWay) {
        callback(msg.data);
      }
    };

    this.messageHandlers.add(listener);
    return () => this.messageHandlers.delete(listener);
  }

  private getCurrentPort() {
    if (this.port) return this.port;

    throw new PorterDisconnectedError();
  }
}
