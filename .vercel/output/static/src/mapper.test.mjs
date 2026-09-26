import assert from "node:assert/strict";
import test from "node:test";
import { dirFor, eventToParams } from "./mapper.js";

const base = {
  usd: 10_000,
  token: { symbol: "PEPE", address: "0xabc" },
  from: { kind: "wallet", label: "A", address: "0x1" },
  chain: "ethereum",
};

test("buy and in swim one way, sell and out the other", () => {
  assert.equal(dirFor({ ...base, side: "buy" }), 1);
  assert.equal(dirFor({ ...base, side: "in" }), 1);
  assert.equal(dirFor({ ...base, side: "sell" }), -1);
  assert.equal(dirFor({ ...base, side: "out" }), -1);
});

test("a transfer is a drift, not a silent sell", () => {
  const params = eventToParams({ ...base, side: "transfer", to: { address: "0x2" } });
  assert.equal(params.behavior, "drift");
  assert.ok(params.dir === 1 || params.dir === -1);
});

test("a missing actor does not throw", () => {
  const params = eventToParams({ usd: 100, side: "transfer", token: { symbol: "X", address: "0x" }, chain: "base" });
  assert.equal(params.behavior, "drift");
  assert.ok(Number.isFinite(params.scale));
});
