import type { CinemaEvent } from "./types.ts";

export const CHAINS = [
  "ethereum",
  "solana",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "bnb",
  "avalanche",
  "all",
] as const;

const CHAIN_SET = new Set<string>(CHAINS);

const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type WatchMode = "wallet" | "token" | "entity";

export type WatchQuery = {
  mode: WatchMode;
  chain: string;
  address: string;
  name: string;
  symbol: string;
  filter: "all" | "trades";
};

export type TokenHit = {
  symbol: string;
  name: string;
  chain: string;
  address: string;
};

export type EntityHit = { name: string };

export type Ranked =
  | { kind: "token"; token: TokenHit }
  | { kind: "entity"; name: string }
  | { kind: "none" };

export function addressOk(chain: string, address: string): boolean {
  if (chain === "solana") return SOLANA.test(address);
  if (chain === "all") return EVM.test(address) || SOLANA.test(address);
  return EVM.test(address);
}

export function shortAddr(address: string): string {
  if (!address) return "unknown";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function dateWindow(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

export function parseWatchQuery(params: URLSearchParams): { ok: true; query: WatchQuery } | { ok: false; error: string } {
  const mode = params.get("mode") || "";
  if (mode !== "wallet" && mode !== "token" && mode !== "entity") {
    return { ok: false, error: "Pick a wallet, a token, or a name." };
  }
  const chain = (params.get("chain") || "ethereum").trim().toLowerCase();
  if (!CHAIN_SET.has(chain)) return { ok: false, error: "That chain isn't on this feed." };
  const filterRaw = params.get("filter") || "all";
  if (filterRaw !== "all" && filterRaw !== "trades") {
    return { ok: false, error: "Feed filter must be everything or trades." };
  }
  const address = (params.get("address") || "").trim();
  const name = (params.get("name") || "").trim();
  const symbol = (params.get("symbol") || "").trim().slice(0, 32);

  if (mode === "entity") {
    if (name.length < 1 || name.length > 80) return { ok: false, error: "Enter a name to search." };
    return { ok: true, query: { mode, chain, address: "", name, symbol, filter: "all" } };
  }
  if (mode === "token" && chain === "all") {
    return { ok: false, error: "Pick a single chain for a token." };
  }
  if (!addressOk(chain, address)) {
    return {
      ok: false,
      error: chain === "solana" ? "That doesn't look like a Solana address." : "That doesn't look like an address on this chain.",
    };
  }
  return {
    ok: true,
    query: { mode, chain, address, name: "", symbol, filter: mode === "token" ? filterRaw : "all" },
  };
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Prefer an exact symbol, then an exact entity name, then an exact token name. */
export function rankSearch(query: string, tokens: TokenHit[], entities: EntityHit[], chain?: string): Ranked {
  const q = norm(query);
  if (!q) return { kind: "none" };

  const symbols = tokens.filter((t) => norm(t.symbol) === q);
  const symbol = preferChain(symbols, chain);
  if (symbol) return { kind: "token", token: symbol };

  const entity = entities.find((e) => norm(e.name) === q);
  if (entity) return { kind: "entity", name: entity.name };

  const names = tokens.filter((t) => norm(t.name) === q);
  const named = preferChain(names, chain);
  if (named) return { kind: "token", token: named };

  const loose = tokens
    .map((t) => ({ t, score: norm(t.symbol).startsWith(q) ? 2 : norm(t.name).startsWith(q) ? 1 : 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (loose.length && entities.length === 0) {
    const same = loose.filter((x) => x.score === loose[0]!.score).map((x) => x.t);
    const pick = preferChain(same, chain) || same[0];
    if (pick) return { kind: "token", token: pick };
  }

  if (entities[0]) return { kind: "entity", name: entities[0].name };
  return { kind: "none" };
}

function preferChain(list: TokenHit[], chain?: string): TokenHit | undefined {
  if (!list.length) return undefined;
  if (chain && chain !== "all") {
    const hit = list.find((t) => t.chain === chain);
    if (hit) return hit;
  }
  return list[0];
}

export function actorOf(address: string, label: unknown): CinemaEvent["from"] {
  const clean = String(label ?? "").trim();
  let kind: CinemaEvent["from"]["kind"] = "wallet";
  if (/fund/i.test(clean)) kind = "fund";
  else if (clean) kind = "smart";
  return { address: address || "", label: clean || shortAddr(address), kind };
}

export function parseTs(s: unknown): number {
  if (typeof s !== "string" || !s) return Date.now();
  const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(s);
  const t = Date.parse(hasZone ? s : `${s.replace(" ", "T")}Z`);
  return Number.isFinite(t) ? t : Date.now();
}

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function usdOf(value: unknown, price?: unknown, amount?: unknown): number {
  const direct = num(value);
  if (direct != null && direct > 0) return Math.round(direct);
  const p = num(price);
  const a = num(amount);
  if (p != null && a != null && p >= 0) return Math.round(Math.abs(p * a));
  return direct != null && direct > 0 ? Math.round(direct) : 0;
}
