import type { EntityHit, TokenHit } from "./query.ts";

// Local stand-ins so name search still resolves in the preview when no Nansen
// key is configured. These are public mainnet contracts, not live positions.
export const DEMO_TOKENS: TokenHit[] = [
  { symbol: "PEPE", name: "Pepe", chain: "ethereum", address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
  { symbol: "LINK", name: "Chainlink", chain: "ethereum", address: "0x514910771af9ca656af840dff83e8264ecf986ca" },
  { symbol: "WETH", name: "Wrapped Ether", chain: "ethereum", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  { symbol: "USDC", name: "USD Coin", chain: "ethereum", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  { symbol: "AERO", name: "Aerodrome", chain: "base", address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631" },
  { symbol: "BNB", name: "BNB", chain: "bnb", address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" },
  { symbol: "BONK", name: "Bonk", chain: "solana", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "JUP", name: "Jupiter", chain: "solana", address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "SOL", name: "Wrapped SOL", chain: "solana", address: "So11111111111111111111111111111111111111112" },
];

export const DEMO_ENTITIES: EntityHit[] = [
  { name: "Binance" },
  { name: "Coinbase" },
  { name: "Jump Trading" },
  { name: "Wintermute" },
];

export const KNOWN_WALLETS: { address: string; label: string }[] = [
  { address: "0x28c6c06298d514db089934071355e5743bf21d60", label: "Binance" },
];

export function tokenByAddress(address: string): TokenHit | undefined {
  const a = address.toLowerCase();
  return DEMO_TOKENS.find((t) => t.address.toLowerCase() === a);
}

export function knownLabel(address: string): string | null {
  const a = address.toLowerCase();
  return KNOWN_WALLETS.find((w) => w.address.toLowerCase() === a)?.label ?? null;
}

export function filterCatalog(query: string, chain: string): { tokens: TokenHit[]; entities: EntityHit[] } {
  const q = query.trim().toLowerCase();
  const tokens = DEMO_TOKENS.filter((t) => {
    if (chain !== "all" && t.chain !== chain) return false;
    if (!q) return true;
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase() === q;
  });
  const entities = DEMO_ENTITIES.filter((e) => !q || e.name.toLowerCase().includes(q));
  return { tokens, entities };
}
