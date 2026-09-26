import { actorOf } from "./query.ts";
import type { CinemaEvent, Side } from "./types.ts";

export type DemoSubject = {
  kind: "wallet" | "token" | "entity";
  chain: string;
  address: string;
  label: string;
  filter: "all" | "trades";
};

const EVM = [
  { symbol: "PEPE", address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
  { symbol: "LINK", address: "0x514910771af9ca656af840dff83e8264ecf986ca" },
  { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
];

const SOL = [
  { symbol: "BONK", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "JUP", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "SOL", address: "So11111111111111111111111111111111111111112" },
];

const DESKS: { label: string; address: string }[] = [
  { label: "Binance", address: "0x28c6c06298d514db089934071355e5743bf21d60" },
  { label: "Coinbase", address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3" },
  { label: "Uniswap", address: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad" },
  { label: "Wintermute", address: "0x00000000ae347930bd1e7b0f35588b92280f9e75" },
  { label: "Pantera Fund", address: "0x4a1e1416b0c1b8a1c0e5c0c0a0b0c0d0e0f0a1b2" },
  { label: "", address: "0x1111111111111111111111111111111111111111" },
];

function book(chain: string) {
  if (chain === "solana") return SOL;
  if (chain === "all") return [...EVM, ...SOL];
  return EVM;
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function usd(rng: () => number): number {
  const r = rng();
  if (r < 0.72) return Math.round(10 ** (2.8 + rng() * 1.5));
  if (r < 0.94) return Math.round(10 ** (4.4 + rng() * 1.1));
  return Math.round(10 ** (5.7 + rng() * 0.7));
}

export function demoAddressFor(name: string): string {
  let x = 2166136261;
  const s = name.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  let out = "";
  for (let i = 0; i < 40; i++) {
    x = Math.imul(x ^ (x >>> 15), 0x6d2b79f5) >>> 0;
    out += (x & 0xf).toString(16);
  }
  return `0x${out.slice(0, 40)}`;
}

export class DemoTide {
  private n = 0;

  constructor(
    private subject: DemoSubject,
    private rng: () => number = Math.random,
  ) {}

  batch(count: number): CinemaEvent[] {
    return Array.from({ length: count }, () => this.one());
  }

  one(): CinemaEvent {
    this.n += 1;
    const chain = this.subject.chain === "all" ? (this.rng() < 0.5 ? "ethereum" : "solana") : this.subject.chain;
    const watched = this.subject.address;
    const label = this.subject.label;
    const dollars = usd(this.rng);
    const id = `demo:${watched}:${this.n}:${Date.now()}`;

    if (this.subject.kind === "token") {
      const token = { symbol: label || "TOKEN", address: watched };
      if (this.subject.filter === "trades") {
        const side: Side = this.rng() < 0.55 ? "buy" : "sell";
        const trader = pick(this.rng, DESKS);
        return {
          id,
          timestamp: Date.now(),
          chain,
          usd: dollars,
          side,
          token,
          from: actorOf(trader.address, trader.label || "Trader"),
          to: null,
          metadata: { txHash: id, source: "demo" },
        };
      }
      const a = pick(this.rng, DESKS);
      let b = pick(this.rng, DESKS);
      if (b.address === a.address) b = DESKS[(DESKS.indexOf(a) + 1) % DESKS.length]!;
      return {
        id,
        timestamp: Date.now(),
        chain,
        usd: dollars,
        side: "transfer",
        token,
        from: actorOf(a.address, a.label),
        to: actorOf(b.address, b.label),
        metadata: { txHash: id, source: "demo", transactionType: "transfer" },
      };
    }

    const token = pick(this.rng, book(chain));
    const side: Side = this.rng() < 0.5 ? "in" : "out";
    const other = pick(this.rng, DESKS);
    const self = actorOf(watched, label);
    const desk = actorOf(other.address, other.label);
    return {
      id,
      timestamp: Date.now(),
      chain,
      usd: dollars,
      side,
      token,
      from: side === "out" ? self : desk,
      to: side === "out" ? desk : self,
      metadata: { txHash: id, source: "demo" },
    };
  }
}
