import assert from "node:assert/strict";
import test from "node:test";
import { fishCaption, formatUsd } from "./fish-labels.js";

test("money stays short enough to sit on a fish", () => {
  assert.equal(formatUsd(0), "");
  assert.equal(formatUsd(840), "$840");
  assert.equal(formatUsd(12_400), "$12k");
  assert.equal(formatUsd(2_400_000), "$2.40M");
});

test("a trade reads as token, side, size, and who", () => {
  const caption = fishCaption({
    side: "buy",
    usd: 48_000,
    token: { symbol: "PEPE" },
    from: { label: "Wintermute" },
  });
  assert.equal(caption.symbol, "PEPE");
  assert.equal(caption.meta, "buy · $48k");
  assert.equal(caption.who, "Wintermute");
});

test("a transfer names both ends instead of pretending it is a sell", () => {
  const caption = fishCaption({
    side: "transfer",
    usd: 900,
    token: { symbol: "BONK" },
    from: { label: "Binance" },
    to: { label: "Coinbase" },
  });
  assert.equal(caption.meta, "move · $900");
  assert.equal(caption.who, "Binance → Coinbase");
});
