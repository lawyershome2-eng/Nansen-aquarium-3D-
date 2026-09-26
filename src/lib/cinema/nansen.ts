// The only module that talks to Nansen. The key stays server-side.

const BASE = "https://api.nansen.ai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NansenError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, path: string, detail: string) {
    super(`Nansen ${status} on ${path}: ${detail.slice(0, 300)}`);
    this.name = "NansenError";
    this.status = status;
    this.detail = detail.slice(0, 300);
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export class NansenClient {
  creditsRemaining: number | null = null;

  constructor(
    private apiKey: string,
    private log: Pick<Console, "warn"> = console,
  ) {
    if (!apiKey) throw new Error("NANSEN_API_KEY missing");
  }

  async post(path: string, body: unknown, { retries = 2 }: { retries?: number } = {}): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(BASE + path, {
          method: "POST",
          headers: { apikey: this.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20_000),
        });
      } catch (err) {
        if (attempt >= retries) throw err;
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      const rem = res.headers.get("x-nansen-credits-remaining");
      if (rem !== null && rem !== "") {
        const n = Number(rem);
        if (Number.isFinite(n)) this.creditsRemaining = n;
      }

      if (res.ok) return res.json();

      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      if (!retryable || attempt >= retries) throw new NansenError(res.status, path, text);
      const ra = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt;
      this.log.warn(`Nansen ${res.status}, retrying in ${wait}ms`);
      await sleep(wait);
    }
  }

  tokenTransfers(args: { chain: string; tokenAddress: string; from: string; to: string; perPage?: number }) {
    return this.post("/api/v1/tgm/transfers", {
      chain: args.chain,
      token_address: args.tokenAddress,
      date: { from: args.from, to: args.to },
      pagination: { page: 1, per_page: args.perPage ?? 40 },
      filters: {
        include_cex: true,
        include_dex: true,
        non_exchange_transfers: true,
        only_smart_money: false,
      },
      order_by: [{ field: "block_timestamp", direction: "DESC" }],
    });
  }

  tokenDexTrades(args: { chain: string; tokenAddress: string; from: string; to: string; perPage?: number }) {
    return this.post("/api/v1/tgm/dex-trades", {
      chain: args.chain,
      token_address: args.tokenAddress,
      only_smart_money: false,
      date: { from: args.from, to: args.to },
      pagination: { page: 1, per_page: args.perPage ?? 40 },
      order_by: [{ field: "block_timestamp", direction: "DESC" }],
    });
  }

  walletTransactions(args: { address: string; chain: string; from: string; to: string; perPage?: number }) {
    return this.post("/api/v1/profiler/address/transactions", {
      address: args.address,
      chain: args.chain,
      date: { from: args.from, to: args.to },
      hide_spam_token: true,
      pagination: { page: 1, per_page: args.perPage ?? 20 },
      order_by: [{ field: "block_timestamp", direction: "DESC" }],
    });
  }

  searchGeneral(query: string, resultType: "token" | "entity" | "any", chain?: string) {
    return this.post("/api/v1/search/general", {
      search_query: query,
      result_type: resultType,
      limit: 12,
      ...(chain && chain !== "all" ? { chain } : {}),
    });
  }

  searchEntityName(query: string) {
    return this.post("/api/v1/search/entity-name", { search_query: query });
  }

  // 100 credits a call. Watch does not call this on its own: transfer rows
  // already carry from/to labels, and a miss still costs the full amount.
  addressLabels(address: string, chain: string) {
    return this.post("/api/v1/profiler/address/labels", {
      address,
      chain,
      pagination: { page: 1, per_page: 10 },
    });
  }
}

let cachedKey = "";
let cached: NansenClient | null = null;

export function getNansen(): NansenClient | null {
  const key = process.env.NANSEN_API_KEY?.trim() || "";
  if (!key) return null;
  if (key !== cachedKey || !cached) {
    cachedKey = key;
    cached = new NansenClient(key);
  }
  return cached;
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof NansenError) return err.retryable;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return true;
  return err instanceof TypeError;
}

export function publicMessage(err: unknown): string {
  if (err instanceof NansenError) {
    if (err.status === 401 || err.status === 403) return "Nansen refused the key.";
    if (err.status === 429) return "Nansen rate limit. Waiting to try again.";
    if (err.status >= 500) return "Nansen is unavailable. Waiting to try again.";
    const detail = err.detail.replace(/\s+/g, " ").trim().slice(0, 160);
    return detail ? `Nansen rejected the watch (${err.status}). ${detail}` : `Nansen rejected the watch (${err.status}).`;
  }
  if (err instanceof Error && err.name === "TimeoutError") return "Nansen took too long. Waiting to try again.";
  if (err instanceof Error && err.message) return err.message.slice(0, 180);
  return "Watch failed.";
}
