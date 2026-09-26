import { actorOf, num, parseTs, usdOf } from "./query.ts";
import type { CinemaEvent, Side } from "./types.ts";

type Raw = Record<string, unknown>;

function row(v: unknown): Raw | null {
  return v && typeof v === "object" ? (v as Raw) : null;
}

export function rowsOf(resp: unknown): Raw[] {
  const body = row(resp);
  const data = body?.data;
  if (!Array.isArray(data)) return [];
  return data.map(row).filter((r): r is Raw => r !== null);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function transferSide(transactionType: unknown): Side {
  const t = str(transactionType).toLowerCase();
  if (t === "buy") return "buy";
  if (t === "sell") return "sell";
  return "transfer";
}

export function normalizeTokenTransfer(
  raw: Raw,
  ctx: { chain: string; address: string; symbol?: string },
): CinemaEvent | null {
  const hash = str(raw.transaction_hash);
  if (!hash) return null;
  const from = str(raw.from_address);
  const to = str(raw.to_address);
  const symbol = ctx.symbol || "TOKEN";
  return {
    id: ["transfer", ctx.chain, hash, from, to, str(raw.transfer_amount)].join(":"),
    timestamp: parseTs(raw.block_timestamp),
    chain: ctx.chain,
    usd: usdOf(raw.transfer_value_usd),
    side: transferSide(raw.transaction_type),
    token: { symbol, address: ctx.address },
    from: actorOf(from, raw.from_address_label),
    to: actorOf(to, raw.to_address_label),
    metadata: {
      txHash: hash,
      source: "nansen:tgm/transfers",
      transactionType: str(raw.transaction_type) || "transfer",
    },
  };
}

export function normalizeTokenTransfers(resp: unknown, ctx: { chain: string; address: string; symbol?: string }): CinemaEvent[] {
  return rowsOf(resp)
    .map((r) => normalizeTokenTransfer(r, ctx))
    .filter((e): e is CinemaEvent => e !== null);
}

export function normalizeTokenTrade(raw: Raw): CinemaEvent | null {
  const hash = str(raw.transaction_hash);
  if (!hash) return null;
  const action = str(raw.action).toUpperCase();
  const side: Side = action === "SELL" ? "sell" : "buy";
  const tokenAddress = str(raw.token_address);
  const trader = str(raw.trader_address);
  return {
    id: ["trade", str(raw.chain), hash, trader, tokenAddress, str(raw.token_amount), action].join(":"),
    timestamp: parseTs(raw.block_timestamp),
    chain: str(raw.chain) || "ethereum",
    usd: usdOf(raw.estimated_value_usd),
    side,
    token: { symbol: str(raw.token_name) || "TOKEN", address: tokenAddress },
    from: actorOf(trader, raw.trader_address_label),
    to: null,
    metadata: {
      txHash: hash,
      source: "nansen:tgm/dex-trades",
      tradedToken: {
        symbol: str(raw.traded_token_name),
        address: str(raw.traded_token_address),
      },
    },
  };
}

export function normalizeTokenTrades(resp: unknown): CinemaEvent[] {
  return rowsOf(resp)
    .map((r) => normalizeTokenTrade(r))
    .filter((e): e is CinemaEvent => e !== null);
}

type Leg = Raw;

function legs(v: unknown): Leg[] {
  if (!Array.isArray(v)) return [];
  return v.map(row).filter((r): r is Leg => r !== null);
}

// One profiler row can move several tokens both ways (a swap is send A, receive B).
// Each leg becomes its own fish. `in` / `out` is which array the leg sat in.
export function normalizeWalletTransaction(raw: Raw, watchedAddress: string): CinemaEvent[] {
  const hash = str(raw.transaction_hash);
  if (!hash) return [];
  const chain = str(raw.chain) || "ethereum";
  const ts = parseTs(raw.block_timestamp);
  const method = str(raw.method);
  const out: CinemaEvent[] = [];

  const push = (leg: Leg, side: "in" | "out", index: number) => {
    const tokenAddress = str(leg.token_address);
    const symbol = str(leg.token_symbol) || (tokenAddress ? tokenAddress.slice(0, 6) : "TOKEN");
    if (!tokenAddress && !str(leg.token_symbol)) return;
    const from = str(leg.from_address) || (side === "out" ? watchedAddress : "");
    const to = str(leg.to_address) || (side === "in" ? watchedAddress : "");
    out.push({
      id: ["wallet", chain, hash, side, tokenAddress || symbol, String(index)].join(":"),
      timestamp: ts,
      chain: str(leg.chain) || chain,
      usd: usdOf(leg.value_usd, leg.price_usd, leg.token_amount),
      side,
      token: { symbol, address: tokenAddress },
      from: actorOf(from, leg.from_address_label),
      to: actorOf(to, leg.to_address_label),
      metadata: { txHash: hash, source: "nansen:profiler/address/transactions", transactionType: method || str(raw.source_type) },
    });
  };

  legs(raw.tokens_sent).forEach((leg, i) => push(leg, "out", i));
  legs(raw.tokens_received).forEach((leg, i) => push(leg, "in", i));

  if (!out.length) {
    const usd = Math.round(num(raw.volume_usd) ?? 0);
    if (usd <= 0) return [];
    out.push({
      id: ["wallet", chain, hash, "call"].join(":"),
      timestamp: ts,
      chain,
      usd,
      side: "transfer",
      token: { symbol: "TX", address: "" },
      from: actorOf(watchedAddress, ""),
      to: null,
      metadata: { txHash: hash, source: "nansen:profiler/address/transactions", transactionType: method || "call" },
    });
  }
  return out;
}

export function normalizeWalletTransactions(resp: unknown, watchedAddress: string): CinemaEvent[] {
  return rowsOf(resp).flatMap((r) => normalizeWalletTransaction(r, watchedAddress));
}
