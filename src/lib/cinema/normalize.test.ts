import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Seen } from "./dedupe.ts";
import { normalizeTokenTrade, normalizeTokenTransfer, normalizeWalletTransaction } from "./normalize.ts";
import { parseTs, parseWatchQuery, rankSearch, usdOf } from "./query.ts";
import type { EntityHit, TokenHit } from "./query.ts";

const TOKENS: TokenHit[] = [
  { symbol: "PEPE", name: "Pepe", chain: "ethereum", address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
  { symbol: "BNB", name: "BNB", chain: "bnb", address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" },
  { symbol: "BONK", name: "Bonk", chain: "solana", address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
];
const ENTITIES: EntityHit[] = [{ name: "Binance" }, { name: "Jump Trading" }];

describe("rankSearch", () => {
  it("prefers an exact symbol over a looser name", () => {
    const hit = rankSearch("pepe", TOKENS, ENTITIES, "ethereum");
    assert.equal(hit.kind, "token");
    if (hit.kind === "token") assert.equal(hit.token.symbol, "PEPE");
  });

  it("does not turn Binance the entity into the BNB token", () => {
    const hit = rankSearch("binance", TOKENS, ENTITIES, "ethereum");
    assert.deepEqual(hit, { kind: "entity", name: "Binance" });
  });

  it("matches a token by its name", () => {
    const hit = rankSearch("chainlink", [{ symbol: "LINK", name: "Chainlink", chain: "ethereum", address: "0x1" }], [], "ethereum");
    assert.equal(hit.kind, "token");
  });
});

describe("parseWatchQuery", () => {
  it("rejects a token watch on every chain at once", () => {
    const parsed = parseWatchQuery(new URLSearchParams("mode=token&chain=all&address=0x6982508145454ce325ddbe47a25d4ec3d2311933"));
    assert.equal(parsed.ok, false);
  });

  it("accepts a solana wallet", () => {
    const parsed = parseWatchQuery(
      new URLSearchParams("mode=wallet&chain=solana&address=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
    );
    assert.equal(parsed.ok, true);
  });
});

describe("normalizers", () => {
  it("reads a transfer as a transfer, not a sell", () => {
    const ev = normalizeTokenTransfer(
      {
        block_timestamp: "2026-09-26T12:00:00Z",
        transaction_hash: "0xabc",
        from_address: "0x1111111111111111111111111111111111111111",
        to_address: "0x2222222222222222222222222222222222222222",
        from_address_label: "",
        to_address_label: "Binance",
        transaction_type: "transfer",
        transfer_amount: "1000",
        transfer_value_usd: 4200,
      },
      { chain: "ethereum", address: "0x6982508145454ce325ddbe47a25d4ec3d2311933", symbol: "PEPE" },
    );
    assert.ok(ev);
    assert.equal(ev.side, "transfer");
    assert.equal(ev.usd, 4200);
    assert.equal(ev.token.symbol, "PEPE");
    assert.equal(ev.to?.label, "Binance");
    assert.equal(ev.from.kind, "wallet");
  });

  it("copies BUY and SELL straight off the trade", () => {
    const sell = normalizeTokenTrade({
      action: "SELL",
      block_timestamp: "2026-09-26T12:00:00Z",
      transaction_hash: "0xdef",
      trader_address: "0x3333333333333333333333333333333333333333",
      trader_address_label: "Fund ABC",
      token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      token_name: "PEPE",
      token_amount: "10",
      estimated_value_usd: 900,
      chain: "ethereum",
    });
    assert.equal(sell?.side, "sell");
    assert.equal(sell?.from.kind, "fund");
    assert.equal(sell?.to, null);
    const buy = normalizeTokenTrade({ ...{ action: "BUY", transaction_hash: "0x1", token_amount: "2" } });
    assert.equal(buy?.side, "buy");
  });

  it("splits a wallet swap into in and out, and fills usd from price when value is null", () => {
    const watched = "0x28c6c06298d514db089934071355e5743bf21d60";
    const events = normalizeWalletTransaction(
      {
        chain: "ethereum",
        method: "swap",
        block_timestamp: "2026-09-26 12:00:00",
        transaction_hash: "0xaaa",
        volume_usd: 3500,
        tokens_sent: [
          {
            token_symbol: "USDC",
            token_address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            token_amount: -1000,
            price_usd: 1,
            value_usd: null,
            from_address: watched,
            to_address: "0x1111111111111111111111111111111111111111",
            from_address_label: "Binance",
            to_address_label: "",
          },
        ],
        tokens_received: [
          {
            token_symbol: "PEPE",
            token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
            token_amount: 5,
            price_usd: 0.00001,
            value_usd: 2500,
            from_address: "0x2222222222222222222222222222222222222222",
            to_address: watched,
            to_address_label: "Binance",
          },
        ],
      },
      watched,
    );
    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((e) => e.side),
      ["out", "in"],
    );
    assert.equal(events[0]?.usd, 1000);
    assert.equal(events[1]?.usd, 2500);
    assert.notEqual(events[0]?.id, events[1]?.id);
    assert.equal(parseTs("2026-09-26 12:00:00"), Date.parse("2026-09-26T12:00:00Z"));
  });

  it("usdOf treats a missing price as zero rather than NaN", () => {
    assert.equal(usdOf(null, null, null), 0);
    assert.equal(usdOf("2500.4"), 2500);
  });
});

describe("Seen", () => {
  it("drops a repeated id and keeps the new one", () => {
    const seen = new Seen();
    const a = { id: "1" } as const;
    const b = { id: "1" } as const;
    const c = { id: "2" } as const;
    assert.deepEqual(
      seen.filter([a, b, c] as never).map((e) => e.id),
      ["1", "2"],
    );
  });
});
