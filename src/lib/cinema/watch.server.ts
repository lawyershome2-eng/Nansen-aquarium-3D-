import { DEMO_ENTITIES, DEMO_TOKENS, filterCatalog, knownLabel, tokenByAddress } from "./catalog.ts";
import { Seen } from "./dedupe.ts";
import { DemoTide, demoAddressFor, type DemoSubject } from "./demo.ts";
import { getNansen, isRetryable, publicMessage, type NansenClient } from "./nansen.ts";
import { normalizeTokenTrades, normalizeTokenTransfers, normalizeWalletTransactions } from "./normalize.ts";
import {
  addressOk,
  dateWindow,
  rankSearch,
  shortAddr,
  type EntityHit,
  type TokenHit,
  type WatchQuery,
  parseWatchQuery,
} from "./query.ts";
import type { CinemaEvent } from "./types.ts";

const MAX_SESSIONS = 6;
const LIVE_POLL_MS = 20_000;
const DEMO_POLL_MS = 2_400;
const FIRST_BATCH = 8;

export class WatchRejected extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "WatchRejected";
  }
}

type Emit = (event: string, data: unknown) => void;

type Runtime = DemoSubject & { note?: string; watchable: boolean };

type Hub = { sessions: Set<WatchSession> };

function hub(): Hub {
  const g = globalThis as typeof globalThis & { __meridianWatch?: Hub };
  g.__meridianWatch ??= { sessions: new Set() };
  return g.__meridianWatch;
}

export function watchStats() {
  return { sessions: hub().sessions.size, live: Boolean(process.env.NANSEN_API_KEY?.trim()) };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function orderTokens(tokens: TokenHit[], chain: string): TokenHit[] {
  return [...tokens].sort((a, b) => Number(b.chain === chain) - Number(a.chain === chain));
}

function mapTokens(raw: unknown): TokenHit[] {
  const body = asRecord(raw);
  const list = body?.tokens;
  if (!Array.isArray(list)) return [];
  const out: TokenHit[] = [];
  for (const item of list) {
    const t = asRecord(item);
    if (!t) continue;
    const address = String(t.address || "");
    const chain = String(t.chain || "");
    const symbol = String(t.symbol || "");
    const name = String(t.name || symbol);
    if (!address || !chain || !symbol) continue;
    out.push({ symbol, name, chain, address });
  }
  return out;
}

function mapEntities(raw: unknown, fromNames: unknown): EntityHit[] {
  const out: EntityHit[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: n });
  };
  const body = asRecord(raw);
  const list = body?.entities;
  if (Array.isArray(list)) {
    for (const item of list) {
      const e = asRecord(item);
      if (e) push(String(e.name || ""));
    }
  }
  const names = asRecord(fromNames);
  const data = names?.data;
  if (Array.isArray(data)) {
    for (const item of data) {
      const e = asRecord(item);
      if (e) push(String(e.entity_name || ""));
    }
  }
  return out;
}

export async function suggestWatch(query: string, chain: string): Promise<{
  live: boolean;
  tokens: TokenHit[];
  entities: (EntityHit & { watchable: boolean })[];
  address: string | null;
}> {
  const q = query.trim();
  const live = Boolean(getNansen());
  if (addressOk(chain, q) || addressOk("all", q)) {
    return { live, tokens: [], entities: [], address: q };
  }
  let tokens: TokenHit[] = [];
  let entities: EntityHit[] = [];
  if (!live) {
    const local = filterCatalog(q, "all");
    tokens = orderTokens(local.tokens, chain);
    entities = local.entities;
  } else {
    const client = getNansen();
    if (!client) throw new WatchRejected("Nansen isn't connected.");
    const names = client.searchEntityName(q).catch(() => ({ data: [] }));
    let general = await client.searchGeneral(q, "any", chain);
    tokens = mapTokens(general);
    if (!tokens.length && chain !== "all") {
      general = await client.searchGeneral(q, "any", "all");
      tokens = mapTokens(general);
    }
    entities = mapEntities(general, await names);
    tokens = orderTokens(tokens, chain);
  }
  return {
    live,
    tokens: tokens.slice(0, 8),
    entities: entities.slice(0, 8).map((e) => ({ ...e, watchable: !live })),
    address: null,
  };
}

class WatchSession {
  private seen = new Seen();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private stopped = false;
  private first = true;
  private calls = 0;
  private runtime: Runtime | null = null;
  private tide: DemoTide | null = null;
  readonly live: boolean;

  constructor(
    private query: WatchQuery,
    private emit: Emit,
    private nansen: NansenClient | null,
  ) {
    this.live = Boolean(nansen);
  }

  start() {
    void this.boot();
  }

  stop() {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    hub().sessions.delete(this);
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.stopped) fn();
    }, ms);
    this.timers.add(t);
  }

  private fail(err: unknown) {
    this.stopped = true;
    this.emit("status", {
      mode: this.live ? "live" : "demo",
      state: "error",
      subject: this.runtime?.label,
      error: err instanceof WatchRejected ? err.message : publicMessage(err),
    });
  }

  private async boot() {
    try {
      await this.resolve();
    } catch (err) {
      if (!this.stopped && isRetryable(err)) {
        this.emit("status", {
          mode: "live",
          state: "degraded",
          error: publicMessage(err),
        });
        this.later(LIVE_POLL_MS, () => void this.boot());
        return;
      }
      this.fail(err);
      return;
    }
    if (this.stopped || !this.runtime) return;
    if (!this.runtime.watchable) {
      this.emit("status", {
        mode: this.live ? "live" : "demo",
        state: "idle",
        subject: this.runtime.label,
        note: this.runtime.note,
        error: null,
      });
      this.stopped = true;
      return;
    }
    this.tide = new DemoTide(this.runtime);
    void this.poll();
  }

  private emitResolved() {
    const r = this.runtime;
    if (!r) return;
    this.emit("resolved", {
      kind: r.kind,
      label: r.label,
      chain: r.chain,
      address: r.address,
      watchable: r.watchable,
      note: r.note ?? null,
    });
    this.emit("status", this.status("connecting"));
  }

  private status(state: string, extra: Record<string, unknown> = {}) {
    return {
      mode: this.live ? "live" : "demo",
      state,
      subject: this.runtime?.label,
      note: this.runtime?.note ?? null,
      error: null,
      calls: this.calls,
      creditsRemaining: this.nansen?.creditsRemaining ?? null,
      ...extra,
    };
  }

  private async resolve() {
    const q = this.query;
    if (q.mode === "wallet") {
      const label = (!this.live && knownLabel(q.address)) || q.symbol || shortAddr(q.address);
      this.runtime = {
        kind: "wallet",
        chain: q.chain,
        address: q.address,
        label,
        filter: "all",
        watchable: true,
        note: this.live ? undefined : "Sample tide. A Nansen key turns this into the live feed.",
      };
      this.emitResolved();
      return;
    }
    if (q.mode === "token") {
      let label = q.symbol || tokenByAddress(q.address)?.symbol || "";
      if (!label && this.nansen) {
        try {
          const hits = mapTokens(await this.nansen.searchGeneral(q.address, "token", q.chain));
          const hit = hits.find((t) => t.address.toLowerCase() === q.address.toLowerCase()) || hits[0];
          if (hit?.symbol) label = hit.symbol;
        } catch {
          /* a missing symbol should not stop the watch */
        }
      }
      this.runtime = {
        kind: "token",
        chain: q.chain,
        address: q.address,
        label: label || shortAddr(q.address),
        filter: q.filter,
        watchable: true,
        note: this.live ? undefined : "Sample tide. A Nansen key turns this into the live feed.",
      };
      this.emitResolved();
      return;
    }
    const found = this.live ? await this.resolveLiveName(q.name, q.chain) : this.resolveDemoName(q.name, q.chain);
    this.runtime = found;
    this.emitResolved();
  }

  private resolveDemoName(name: string, chain: string): Runtime {
    const { tokens, entities } = filterCatalog(name, chain === "all" ? "all" : chain);
    const pool = tokens.length ? tokens : filterCatalog(name, "all").tokens;
    const ranked = rankSearch(name, pool, entities.length ? entities : filterCatalog(name, "all").entities, chain);
    return this.runtimeFromRank(ranked, name, chain, false);
  }

  private async resolveLiveName(name: string, chain: string): Promise<Runtime> {
    const client = this.nansen;
    if (!client) throw new WatchRejected("Nansen isn't connected.");
    const names = client.searchEntityName(name).catch(() => ({ data: [] }));
    let general = await client.searchGeneral(name, "any", chain);
    let tokens = mapTokens(general);
    if (!tokens.length && chain !== "all") {
      general = await client.searchGeneral(name, "any", "all");
      tokens = mapTokens(general);
    }
    const entities = mapEntities(general, await names);
    return this.runtimeFromRank(rankSearch(name, tokens, entities, chain), name, chain, true);
  }

  private runtimeFromRank(ranked: ReturnType<typeof rankSearch>, name: string, chain: string, live: boolean): Runtime {
    if (ranked.kind === "token") {
      const t = ranked.token;
      return {
        kind: "token",
        chain: t.chain,
        address: t.address,
        label: t.symbol,
        filter: "all",
        watchable: true,
        note: live ? undefined : "Sample tide. A Nansen key turns this into the live feed.",
      };
    }
    if (ranked.kind === "entity") {
      // Address Transactions does not accept entity_name. Counterparties and
      // balances that do accept it return other people's wallets, or a blank
      // address. Don't spend credits proving that again.
      if (live) {
        return {
          kind: "entity",
          chain,
          address: "",
          label: ranked.name,
          filter: "all",
          watchable: false,
          note: "Nansen won't give this name a wallet on the transactions feed. Paste a hot-wallet address.",
        };
      }
      return {
        kind: "entity",
        chain: chain === "all" ? "ethereum" : chain,
        address: demoAddressFor(ranked.name),
        label: ranked.name,
        filter: "all",
        watchable: true,
        note: "Sample tide for this name, not their real wallets. Paste a hot wallet to watch a real one.",
      };
    }
    const local = !live ? rankSearch(name, DEMO_TOKENS, DEMO_ENTITIES, chain) : null;
    if (local && local.kind !== "none") return this.runtimeFromRank(local, name, chain, live);
    throw new WatchRejected(`Nothing matched “${name}”.`);
  }

  private async fetchEvents(): Promise<CinemaEvent[]> {
    const r = this.runtime;
    if (!r) return [];
    if (!this.nansen || !this.live) {
      return this.tide?.batch(this.first ? FIRST_BATCH : 1) ?? [];
    }
    const { from, to } = dateWindow();
    if (r.kind === "token" && r.filter === "trades") {
      return normalizeTokenTrades(
        await this.nansen.tokenDexTrades({ chain: r.chain, tokenAddress: r.address, from, to }),
      );
    }
    if (r.kind === "token") {
      return normalizeTokenTransfers(
        await this.nansen.tokenTransfers({ chain: r.chain, tokenAddress: r.address, from, to }),
        { chain: r.chain, address: r.address, symbol: r.label },
      );
    }
    return normalizeWalletTransactions(
      await this.nansen.walletTransactions({ address: r.address, chain: r.chain, from, to }),
      r.address,
    );
  }

  private absorbLabels(events: CinemaEvent[]) {
    const r = this.runtime;
    if (!r || (r.kind !== "wallet" && r.kind !== "entity")) return;
    const addr = r.address.toLowerCase();
    for (const ev of events) {
      for (const actor of [ev.from, ev.to]) {
        if (!actor) continue;
        if (actor.address.toLowerCase() === addr && actor.kind !== "wallet" && actor.label) {
          r.label = actor.label;
          return;
        }
      }
    }
  }

  private async poll() {
    if (this.stopped || !this.runtime) return;
    const pollMs = this.live ? LIVE_POLL_MS : DEMO_POLL_MS;
    try {
      const events = await this.fetchEvents();
      if (this.stopped) return;
      this.absorbLabels(events);
      let fresh = this.seen.filter(events).sort((a, b) => a.timestamp - b.timestamp);
      if (this.first) fresh = fresh.slice(-FIRST_BATCH);
      this.first = false;
      const gap = fresh.length ? Math.min(this.live ? 900 : 380, (pollMs * 0.75) / fresh.length) : 0;
      fresh.forEach((ev, i) => this.later(i * gap, () => this.emit("cinema", ev)));
      this.calls += 1;
      this.emit("status", this.status("running"));
      this.later(pollMs, () => void this.poll());
    } catch (err) {
      if (this.stopped) return;
      if (isRetryable(err)) {
        this.emit("status", this.status("degraded", { error: publicMessage(err) }));
        this.later(pollMs, () => void this.poll());
        return;
      }
      this.fail(err);
    }
  }
}

export function cinemaWatch(request: Request): Response {
  const parsed = parseWatchQuery(new URL(request.url).searchParams);
  const encoder = new TextEncoder();
  let session: WatchSession | null = null;
  let hb: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          session?.stop();
        }
      };
      controller.enqueue(encoder.encode("retry: 10000\n\n"));
      if (!parsed.ok) {
        emit("status", { mode: "live", state: "error", error: parsed.error });
        return;
      }
      if (hub().sessions.size >= MAX_SESSIONS) {
        emit("status", { mode: "live", state: "error", error: "Too many watches are open right now. Close one and try again." });
        return;
      }
      session = new WatchSession(parsed.query, emit, getNansen());
      hub().sessions.add(session);
      session.start();
      hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": hb\n\n"));
        } catch {
          if (hb) clearInterval(hb);
        }
      }, 15_000);
      const drop = () => {
        if (hb) clearInterval(hb);
        session?.stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", drop);
    },
    cancel() {
      if (hb) clearInterval(hb);
      session?.stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function watchSuggestResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const chain = (url.searchParams.get("chain") || "ethereum").trim().toLowerCase();
  if (!q || q.length > 200) {
    return Response.json({ live: Boolean(getNansen()), tokens: [], entities: [], address: null, error: "Enter a name or symbol." });
  }
  try {
    const data = await suggestWatch(q, chain);
    return Response.json({ ...data, error: null });
  } catch (err) {
    return Response.json({
      live: Boolean(getNansen()),
      tokens: [],
      entities: [],
      address: null,
      error: err instanceof WatchRejected ? err.message : publicMessage(err),
    });
  }
}
