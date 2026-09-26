# Watch Mode: search a wallet, token, or labeled entity and watch it live

Status: architecture only, still nothing implemented in code. Phase A (endpoint
verification, section 9) is complete -- real request AND response shapes for all
three event endpoints are confirmed and folded into sections 1, 1.5, 5, and 8 below.
Written so a different session or a different tool can build Phase B onward from this
file alone.

Grounded against Nansen's live docs (docs.nansen.ai) plus two real rounds of API calls
against a live key (raw output in `phase-a/` alongside this doc). Everything in
sections 1, 1.5, 5, and 8 marked "confirmed live" or "real response fields" came from
those calls, not from documentation or assumption. A few things this document got
wrong on the first pass are left visible rather than silently fixed -- see the
`entity_name` correction in section 1C and the credits correction in section 3.1 --
because the corrections themselves are useful context for whoever builds this next.

---

## 0. What "Smart Money Ocean" (the page that already exists) actually is

This is worth being precise about, because it's the thing this new mode is NOT.

Smart Money Ocean polls `smart-money/dex-trades`. Nansen's own docs describe the Smart
Money API as covering addresses labeled **Smart Trader** (30D/90D/180D/all-time
performers) and **Funds** -- and they explicitly say this **excludes whales,
influencers, and other large holder categories**. So Smart Money Ocean shows one curated
cohort's trading activity, not "everyone," and not any specific wallet or token you
choose. There's no address input at all -- it's a fixed, opinionated feed.

Watch Mode is the opposite shape: you pick the subject (a specific wallet, a specific
token contract, or a named entity like an exchange), and you see **everything** at
whichever endpoint fits that subject -- not filtered to a curated trader cohort.

---

## 1. Three input types, three endpoint choices

The search box accepts one of three things. Detection logic is in section 4.

### A. Token contract address -> `tgm/transfers` (default: everything)

    POST https://api.nansen.ai/api/v1/tgm/transfers
    {
      "chain": "ethereum",
      "token_address": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      "date": { "from": "2026-09-19", "to": "2026-09-26" },  // REQUIRED -- confirmed by Phase A, a 422 without it
      "pagination": { "page": 1, "per_page": 50 },
      "filters": {
        "include_cex": true,
        "include_dex": true,
        "non_exchange_transfers": true,
        "only_smart_money": false
      },
      "order_by": [{ "field": "block_timestamp", "direction": "DESC" }]
    }

This is the default for Token Watch, and it's the literal "everything at the API
endpoint, like Etherscan as a movie" the whole feature is for: direct transfers, DEX
trades, and CEX deposit/withdrawal movements for that token, all in one feed. It does
not have a clean `action`/BUY-SELL field the way dex-trades does (a plain
wallet-to-wallet transfer isn't a trade), which is a feature here, not a gap to patch --
see section 1.5 on why forcing everything into buy/sell would misrepresent what this
mode actually shows.
Source: docs.nansen.ai/api/token-god-mode/token-transfers

Real response fields, confirmed live (5-row PEPE/ethereum sample): `block_timestamp`
(with trailing `Z`), `transaction_hash`, `from_address`/`to_address`,
`from_address_label`/`to_address_label` (can be `""`), `transaction_type` (all 5
sampled rows were `"transfer"` -- see section 1.5 for why this sample may not be
representative), `transfer_amount` (raw token units, not USD), `transfer_value_usd`.
No token address/symbol on the item itself (implied by the request's `token_address`),
no `action` field. Top level: `data[]` plus `pagination: { page, per_page,
is_last_page }`.

### A2. Token contract address, "Trades" filter -> `tgm/dex-trades`

    POST https://api.nansen.ai/api/v1/tgm/dex-trades
    {
      "chain": "solana",
      "token_address": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
      "only_smart_money": false,
      "date": { "from": "2026-09-19", "to": "2026-09-26" },  // REQUIRED -- confirmed by Phase A
      "pagination": { "page": 1, "per_page": 50 },
      "filters": {
        "action": "BUY",                          // optional, omit for both sides
        "estimated_value_usd": { "min": 1000 },
        "include_smart_money_labels": ["Whale", "Smart Trader"],  // optional
        "token_amount": { "min": 100 }
      },
      "order_by": [{ "field": "block_timestamp", "direction": "DESC" }]
    }

`only_smart_money: false` is still what makes this "everyone," not the curated cohort
Smart Money Ocean shows. This is an optional narrower mode within Token Watch, offered
as a filter/toggle ("Trades only") once A is working -- not the default, and not the
thing that defines what Token Watch is. It has a clean `action` field (BUY/SELL) that
maps directly onto `CinemaEvent.side` when this filter is active.
Source: docs.nansen.ai/api/token-god-mode/dex-trades

Real response fields, confirmed live (5-row PEPE/ethereum sample, `SELL, SELL, SELL,
SELL, BUY`): `block_timestamp`, `transaction_hash`, `trader_address`,
`trader_address_label`, **`action`: `"BUY"` or `"SELL"`** exactly as expected --
`side` for this mode is a direct 1:1 copy, no inference needed, unlike Smart Money
Ocean's existing stablecoin-guessing heuristic. Also `token_address`/`token_name`/
`token_amount` (the watched token, the request's own `token_address` echoed back with
the traded amount), `traded_token_address`/`traded_token_name`/`traded_token_amount`
(the other leg of the swap), `estimated_swap_price_usd`, `estimated_value_usd`. No
separate `from`/`to` pair the way `tgm/transfers` has -- there's one `trader_address`,
matching the existing Smart Money normalizer's `to: null` pattern.

### B. Wallet address -> `profiler/address/transactions`

    POST https://api.nansen.ai/api/v1/profiler/address/transactions
    {
      "address": "0x28c6c06298d514db089934071355e5743bf21d60",
      "chain": "ethereum",
      "date": { "from": "2026-09-19", "to": "2026-09-26" },  // REQUIRED -- confirmed by Phase A
      "hide_spam_token": true,
      "filters": { "volume_usd": { "min": 100 } },
      "pagination": { "page": 1, "per_page": 20 },
      "order_by": [{ "field": "block_timestamp", "direction": "ASC" }]
    }

"Complete transaction history with labels" for one address -- takes a single address,
not a list. `chain: "all"` **confirmed working** by the Phase A follow-up (returned a
real, slightly different result set than `chain: "ethereum"` alone -- not just an
alias that errors). This is the broad "watch everything this wallet does" feed.
Source: docs.nansen.ai/api/profiler/address-transactions

Real response fields, confirmed live (5-row sample, one Binance-labeled hot wallet):
each item has `chain`, `method` (e.g. `"transfer(address,uint256)"`, `"sent"`),
`tokens_sent[]`, `tokens_received[]`, `volume_usd`, `block_timestamp` (**no trailing
`Z`** -- unlike the TGM endpoints' timestamps, worth confirming it's UTC rather than
assuming; the existing `parseTs()` in `server/normalize.js` already appends `Z` when
one's missing, so this is a non-issue for reuse, just worth knowing why), a
`transaction_hash`, and `source_type` (all 5 sampled rows were `"transfer"`, same
open question as section 1.5 notes for `tgm/transfers`). Each entry in
`tokens_sent`/`tokens_received` carries its own `token_symbol`, `token_address`,
`chain`, `token_amount` (negative on the sent side), `price_usd`, `value_usd` (often
`null` in the sample), and `from_address`/`to_address`/`*_label`.

There is no top-level direction field -- see section 1.5 for how `in`/`out` gets
derived from which of the two arrays is populated, and the multi-token-per-transaction
wrinkle that follows from it.

Credit cost: **confirmed by Phase A at 1 credit per call**, on both success and
failure. On a 200, `x-nansen-credits-cost`, `x-nansen-credits-used`, and
`x-nansen-credits-remaining` (a real running balance, e.g. `1094 -> 1093 -> 1092`)
are all present. On a 422, only `x-nansen-credits-cost` shows up -- no `remaining`, no
`used`. See section 3.1 for why "charged even on failure, silent on what's left" is a
real design constraint, not just a cost curiosity, and for a correction to what this
document first assumed about `server/nansen.js`'s existing credit-tracking code.

### C. A name (e.g. "binance", "jump") -> `search/entity-name`, then... not straight into B after all

    POST https://api.nansen.ai/api/v1/search/entity-name
    { "search_query": "binance" }

    -> { "data": [{ "entity_name": "Binance" }, { "entity_name": "Binance Charity" },
                   { "entity_name": "Binance JEX" }, { "entity_name": "Binance Labs" },
                   { "entity_name": "Binance Rabbit" }, { "entity_name": "Binance Smart Chain" },
                   { "entity_name": "Binance Smart Chain Fund" }, { "entity_name": "Binance US" },
                   { "entity_name": "Binance Wallet" }, { "entity_name": "Binance Wealth Matrix" }] }

Confirmed live by Phase A: 10 results, `entity_name` is the ONLY field per item -- no
address, no label, no type, no pagination wrapper. This is purely a name-formatting
lookup ("what's the exact string Nansen expects"), not an address resolver, and the
person picks the right one from a plain list of strings.

**This section originally said the resolved `entity_name` could go straight into
`profiler/address/transactions` in place of `address`, based on three sibling Profiler
endpoints' docs showing that pattern. The Phase A follow-up tested it directly against
this exact endpoint and it does NOT work:**

    { "entity_name": "Binance", "chain": "all", "date": {...} }
    -> 422: "Required field 'body -> address' is missing" AND
            "Field 'entity_name' is not recognized. Please check the API
             documentation for valid request fields."

So the pattern documented on Address Counterparties / Address Historical Balances /
Address PnL does not transfer to Address Transactions specifically -- each Profiler
endpoint apparently opts into `entity_name` support individually, not as a blanket
Profiler-wide feature. This was this document's own error in generalizing from three
examples to a fourth untested endpoint; corrected here rather than left standing.

**Name-based Wallet Watch is therefore still an open problem**, not the solved
one-extra-call flow this section originally described. Two directions worth testing,
neither tried yet:
1. Call one of the endpoints that DOES document `entity_name` support (Address
   Counterparties or Address Historical Balances) with the resolved `entity_name`, and
   check whether its response happens to surface a concrete address for that entity
   (e.g. a counterparty list item, or a balances-by-address breakdown) that could then
   be fed into `profiler/address/transactions` as a normal `address`. Not confirmed
   either way -- worth one more real call before assuming it works.
2. Fall back to not supporting name-based Wallet Watch in Phase D/E and revisit later,
   shipping direct-address wallet search first (section B, fully working today) and
   direct-address/name token search (section A, via the unified search endpoint,
   untested here but a different endpoint with different documented behavior).

Source: docs.nansen.ai/api/profiler/entity-name-search,
docs.nansen.ai/api/profiler/address-transactions (this document's own Phase A test)

Token names are a **separate flow** regardless of how (1) above resolves: `entity_name`
is a wallet/entity concept (Profiler), while a token search needs `POST /api/v1/search`
with `result_type: "token"`, which resolves a name/symbol to a `token_address` for the
TGM endpoints in section A/A2 instead. Its own docs describe exactly this: "Find token
addresses: Search by name or symbol to get contract addresses" and "Resolve addresses:
Search by contract address to identify tokens." Not tested live in either Phase A
round -- still open.
Source: docs.nansen.ai/api/search

---

## 1.5. Event semantics: direction policy, not buy/sell

This section exists because of a real mistake worth stating plainly rather than
quietly fixing: the first draft of this document defaulted Token Watch to the
trades-only endpoint and framed its normalizer around BUY/SELL, because the existing
`CinemaEvent.side` field is shaped that way for Smart Money Ocean, and it was easier to
reuse that shape than to ask what Watch Mode's own events actually are. Watch Mode is
an explorer -- "everything concerning this subject" -- not a trading view, and most of
what it shows (plain transfers, CEX deposits/withdrawals) has no buy/sell meaning at
all.

The table below was originally written from the endpoints' documented *request*
shapes, before any of them had returned real data. The Phase A follow-up got real
responses from all three, and the real fields changed this table -- notably, a token
doesn't have "sides" the way a wallet does, so the original `tgm/transfers` row (which
guessed at an in/out-relative-to-the-token framing) didn't survive contact with the
actual response shape:

| Source | `side` value | Where it actually comes from |
|---|---|---|
| `tgm/dex-trades` (Trades filter) | `buy` / `sell` | directly from the response's own `action` field -- confirmed live, no inference needed |
| `tgm/transfers` (default) | `transfer` | every sampled row's `transaction_type` was `"transfer"` -- there's no per-item buy/sell/in/out concept here, just a `from_address`/`to_address` pair moving the watched token between two arbitrary wallets. See the note below on why this sample may be incomplete, not a proof that it's always `"transfer"` |
| `profiler/address/transactions` (Wallet Watch) | `in` / `out` | **not a field** -- inferred structurally from whether the watched address's activity shows up in that item's `tokens_sent[]` or `tokens_received[]` array |

**Why the `tgm/transfers` sample may be incomplete:** the request in section 1A lists
`include_cex` / `include_dex` / `non_exchange_transfers` as filters that can select for
richer transfer types, but the Phase A follow-up call omitted that `filters` block
entirely (simplified out of the curl command, not a deliberate test of the default).
All 5 sampled rows came back `transaction_type: "transfer"` -- that may be this token's
real activity in this window, or it may be what you get without those filters set.
Worth a follow-up call with `filters` populated before assuming `transfer` is the only
value this field ever takes.

**A wrinkle `profiler/address/transactions` surfaces that the others don't:** a single
raw item can have entries in *both* `tokens_sent[]` and `tokens_received[]` (a DEX swap
looks like this from a wallet's own perspective -- sent token A, received token B in
the same transaction), and each array can hold more than one token. That means one raw
transaction may need to become more than one `CinemaEvent` (one entity per token
moved, each with its own `in`/`out`), not a strict one-item-in-one-event-out mapping
the way the other two endpoints are. This needs an explicit decision in Phase B/C, not
an assumption -- see section 5.

**Known code implication, not yet fixed (still architecture-only):**
`web/src/mapper.js` currently has `dir: ev.side === 'buy' ? 1 : -1`, which silently
treats anything that isn't literally `'buy'` as if it were a `'sell'`. `in`/`out`/
`transfer` events would swim backwards under today's code. This needs a real
dispatch across all values `side` can actually take (`buy`, `sell`, `in`, `out`,
`transfer`) before Watch Mode events reach the simulation correctly. Flagged here,
addressed in Phase C below.

---

## 2. Address-type detection

Two options, pick one for v1:

**Option 1 -- explicit toggle (recommended for v1).** The search UI has a small
mode switch: "Wallet" / "Token" / "Search by name", set by the person, not guessed.
Simplest to build, zero ambiguity, zero wasted API calls on a wrong guess.

**Option 2 -- auto-detect.** Use the unified `/api/v1/search` endpoint's
`result_type: "any"` first; if it comes back a token, run flow A; if an entity, run
flow B/C; if nothing, assume raw wallet address and try flow B directly. More
seamless, costs one extra call per search, and needs real testing to see how reliably
it distinguishes a token contract from a wallet that happens to hold that token (they're
both just addresses on-chain; the distinguishing signal is metadata Nansen already
has -- a token has a symbol/name/decimals, a wallet doesn't).

Format-level address validation (regex) can happen client-side regardless of which
option is chosen, just to catch typos before spending a call: `0x[0-9a-fA-F]{40}` for
EVM chains, base58 32-44 chars for Solana. This doesn't distinguish wallet from token
(both are addresses shaped the same way) -- it only catches "that's not an address at
all," which routes to the name-search flow instead.

---

## 3. Why this can't share Smart Money Ocean's one-poller architecture

Smart Money Ocean works because every viewer sees the *same* feed, so one server-side
poll serves everyone (see `server/poller.js`). Watch Mode is the opposite: every search
is a different address, so it's inherently per-request, not shareable.

    Smart Money Ocean            Watch Mode
    ──────────────────           ──────────────────
    1 poll  ──> N viewers        1 poll  ──> 1 viewer (this search)
    (shared, cheap)              (dedicated, scales with concurrent searches)

Consequences to design for:
- A poller must start when someone submits a search and stop when they navigate away
  or search something else -- it can't just run forever like the Smart Money poller
  does today.
- Credit cost scales with **concurrent distinct searches × poll frequency**, not with
  viewer count. Ten people watching the same Smart Money Ocean costs one poll; ten
  people watching ten different wallets costs ten polls. This needs a cap (e.g. max N
  concurrent watch-sessions server-wide) before this is ever public, the same way the
  original architecture doc flagged for Smart Money Ocean itself.
- A sensible poll interval is probably longer than Smart Money Ocean's (a specific
  wallet or token trades far less often than the whole smart-money cohort combined), so
  this may not need 5-10s polling at all -- 15-30s is likely plenty and meaningfully
  cheaper. Confirm against real traffic once Phase A is done.
- The existing `dedupe.js` (`Seen` class) and the batch-spreading logic in
  `poller.js`'s `startLive()` both generalize directly to a per-session poller; they
  don't assume Smart Money Ocean specifically, just "some Nansen call on an interval."
  The retry behavior does NOT generalize safely as-is -- see 3.1 below.

### 3.1. Confirmed by Phase A: failed calls still cost credits, and neither poller currently stops for that

Phase A's three 422s (missing `date`) each carried `x-nansen-credits-cost: 1` -- Nansen
charges for a rejected request, not just a successful one. That changes what "retry
this on error" is allowed to mean.

`server/poller.js`'s existing `startLive()` (already shipped, driving Smart Money
Ocean today) does this on any error, no matter what kind:

    } catch (err) {
      this.log.error(String(err.message || err));
      this.setStatus({ state: 'degraded', error: String(err.message || err) });
    }
    this.later(this.cfg.pollMs, poll);   // <-- runs unconditionally, success or failure

A transient error (429 rate limit, 5xx) SHOULD retry after a wait -- that's correct
and already how `nansen.js`'s own `post()` retry logic treats those. But a 422 is not
transient: it means the request shape itself is wrong (a bad date range, a malformed
filter), and it will keep failing identically forever. Left as-is, that's 1 credit
burned every single `pollMs` interval, indefinitely, logged to a console nobody may be
watching. This isn't a hypothetical for Watch Mode specifically -- it's a real gap in
the code already running Smart Money Ocean, just harder to trigger there since its
request shape is fixed and known-good, versus Watch Mode where the request shape
depends on whatever address/date range a person or a bug produces.

**Requirement for the `WatchSession` poller (and worth retrofitting into `Poller` too,
separately from this feature):** distinguish retryable (429, 5xx -- wait and retry)
from non-retryable (4xx other than 429 -- log once, set `state: 'error'`, and STOP the
polling loop entirely rather than rescheduling) failures. A non-retryable failure should
require a new search (a new `WatchSession`) to clear, not silently keep spending
credits every interval.

**Correction from the Phase A follow-up:** the paragraph that stood here first claimed
`x-nansen-credits-remaining` was dead code because round one's three 422s never showed
it. Round two's 200 responses did: `x-nansen-credits-cost`, `x-nansen-credits-used`,
and `x-nansen-credits-remaining` (a real decrementing balance, e.g. `1094 -> 1093 ->
1092 -> 1091` across successive calls) are all present on success. They're absent only
on 4xx failures -- same pattern both rounds. So `server/nansen.js`'s existing
`res.headers.get('x-nansen-credits-remaining')` is NOT dead code; it correctly tracks
a real running balance after every successful call, and simply has nothing to update
from after a failed one, which is a reasonable, not broken, degradation (there's
arguably no meaningful "remaining" to report for a request Nansen rejected before
doing any accounting). The first draft's claim here was wrong -- corrected rather than
left standing, since it was based on incomplete data (only error responses existed at
the time it was written).

Suggested shape: a `WatchSession` class parallel to `Poller`, one instance per active
SSE connection, holding its own `chain`/`address`/`mode`, its own `Seen` instance, and
its own `setTimeout` loop (with the retryable/non-retryable distinction above baked
in), torn down on `req.on('close')`. `server/index.js`'s existing per-client SSE
bookkeeping (the `clients` Set) already shows the pattern to follow, just keyed
per-session instead of broadcast to all clients.

---

## 4. Server route shape

    GET /api/watch/stream?mode=token&chain=solana&address=<addr>              // default: everything (tgm/transfers)
    GET /api/watch/stream?mode=token&chain=solana&address=<addr>&filter=trades // Trades only (tgm/dex-trades)
    GET /api/watch/stream?mode=wallet&chain=ethereum&address=<addr>
    GET /api/watch/stream?mode=entity&name=<query>          // resolves, then behaves like wallet/token

SSE, same `event: cinema` / `event: status` shape the existing `/api/stream` uses, so
the client's existing `web/src/stream.js` needs zero changes -- it already just takes a
`url`. A `mode=entity` request resolves the name server-side first (via
`search/entity-name` or the unified search endpoint, per section 1C), then proceeds as
whichever of A/B it resolves to, emitting an early `event: resolved` message so the
client can show "watching: Binance (entity_name: Binance: Hot Wallet)" before any
events arrive.

No separate start/stop endpoint needed -- opening the SSE connection starts the
session, closing it (navigating away, searching something new) stops it, mirroring how
`/api/stream` already works.

---

## 5. Normalizers

Three new ones, alongside the existing `normalizeDexTrade` in `server/normalize.js`,
each following the direction policy from section 1.5, and now written against real
confirmed fields rather than guessed ones:

**`normalizeTokenTransfer(raw)`** -- for `tgm/transfers`, the default Token Watch feed.
Real fields: `from_address`/`to_address` (plus `*_label`, can be `""`),
`transfer_value_usd` -> `usd`, `transfer_amount` (raw units, not needed for
`CinemaEvent`), `transaction_hash`, `block_timestamp`. `token` comes from the request's
own `token_address` (the item has none), passed into the normalizer as a second
argument. `side` is `'transfer'` for anything not yet observed as something richer --
see section 1.5's open question on whether `transaction_type` ever holds a DEX/CEX
value once the `filters` block is actually populated in a request; if it does, this
normalizer will need to branch on it.

**`normalizeTokenTrade(raw)`** -- for `tgm/dex-trades`, only invoked when the Trades
filter is active. Confirmed the easiest of the three: `action` maps straight to
`side: 'buy' | 'sell'`, no inference needed, unlike the stablecoin-guessing heuristic
the Smart Money normalizer needs for the same job. `trader_address`/
`trader_address_label` -> `from` (`to: null`, same pattern as the existing Smart Money
normalizer -- there's genuinely no second party here, just a trader and the pool).
`token_address`/`token_name` -> `token` (the watched token; note `traded_token_*` is
the OTHER leg of the swap and is metadata, not the primary `token`).
`estimated_value_usd` -> `usd`.

**`normalizeWalletTransaction(raw, watchedAddress)`** -- for `profiler/address/
transactions`. Confirmed the one genuine structural surprise: there's no direction
field to read, and a single raw item can carry BOTH `tokens_sent[]` and
`tokens_received[]` (a DEX swap looks like this from the wallet's own point of view --
sent one token, received another, same transaction), and either array can hold more
than one token. That means this normalizer can't be a strict one-item-in,
one-`CinemaEvent`-out function the way the other two are -- it needs to return an
**array** of zero or more events per raw item: one per token in `tokens_sent`
(`side: 'out'`) plus one per token in `tokens_received` (`side: 'in'`), each carrying
that token entry's own `token_symbol`/`token_address`/`token_amount`/`value_usd` (often
`null` in the sample -- may need `price_usd * abs(token_amount)` as a fallback, or to
skip items where both are unavailable). `volume_usd` on the raw item is the
transaction's total, not any one token's value, so it's not a reliable per-`usd`
source when multiple tokens moved. `block_timestamp` has no trailing `Z` here (unlike
the TGM endpoints) -- `server/normalize.js`'s existing `parseTs()` already appends one
when missing, so this needs no new handling, just worth knowing why the two families
of endpoints look different. This "one raw item -> N events" shape is a real
architectural difference from the existing pipeline's assumption (`normalizeDexTrades`
today does one raw row -> one event via a simple `.map()`); the poller/dedupe code
that calls the normalizer needs to `.flatMap()` here instead, and each of the N events
needs its own unique `id` (the existing `id` construction pattern, hashing several
fields together, generalizes fine -- just needs the token index folded in so the two
events from one transaction don't collide).

All three should still produce the same `CinemaEvent` shape the rest of the pipeline
already consumes (`id, timestamp, chain, usd, side, token, from, to, metadata`) -- that
contract is the reason the simulation, the reef bridge, and the event-fish marker
(`fishTrim.w`) don't need to change at all for this feature. What DOES need to change,
per section 1.5, is `web/src/mapper.js`'s `dir` line, so it dispatches on every value
`side` can actually take instead of collapsing everything to a buy/sell binary.
Everything else past normalization is already built.

---

## 6. Client / UI

A new small search UI -- doesn't need its own full page necessarily, could be a bar at
the top of `/reefscape/index.html` (or a new `/watch/index.html` reusing the same reef
scene + bridge). Needs:

- Text input for the address/name
- Mode toggle (wallet / token / search-by-name) unless auto-detect (section 2) is built
- Chain select (reuse the chain list already in `.env.example`'s `CHAINS`)
- A "watching: <resolved name/label>" status line, filled in from the `event: resolved`
  message and/or a `profiler/address/labels` lookup (see section 7)
- Submit opens (or re-opens, closing any previous one) an EventSource to
  `/api/watch/stream?...`

Everything downstream -- `Simulation`, `meridian-bridge.js`, the event-fish marker --
is reused unchanged, since it only ever consumed `CinemaEvent`, never Nansen's raw
shape.

---

## 7. Label lookup (the "Nansen already labeled this" part of the ask)

    POST https://api.nansen.ai/api/v1/profiler/address/labels
    { "address": "<addr>", "chain": "ethereum" }

Called once when a search resolves to a concrete address (whether typed directly or
resolved from a name search), purely to populate the "watching: Binance 14" style label
in the UI. Separate from the event stream itself -- this is a one-shot lookup, not
something to poll.

---

## 8. What's confirmed vs. what's still open (Phase A complete, two rounds)

Phase A ran in two rounds against a live key. Full raw output in `phase-a/` alongside
this doc. Round one hit a required-`date` wall on three of five calls; round two added
`date` and got real data back from all three, plus one targeted extra call testing
whether `entity_name` works on `profiler/address/transactions` specifically (it
doesn't -- see section 1C).

Confirmed, from real responses:
- `date: { from, to }` is required on `tgm/transfers`, `tgm/dex-trades`, and
  `profiler/address/transactions`
- Real response fields for all three event endpoints -- see sections A, A2, and B for
  the full field lists
- `tgm/dex-trades.action` is a clean `"BUY"`/`"SELL"` string, direct 1:1 with
  `CinemaEvent.side` when the Trades filter is active
- `tgm/transfers.transaction_type` exists as a field, but every sampled row was
  `"transfer"` -- open whether richer values exist (see below)
- `profiler/address/transactions` has no top-level direction field; `in`/`out` is
  structural, from `tokens_sent[]`/`tokens_received[]`, and a single item can produce
  more than one `CinemaEvent` -- see section 5
- `chain: "all"` works on `profiler/address/transactions` and returns a genuinely
  different result set than `chain: "ethereum"` alone, not an alias/error
- `profiler/address/transactions` does NOT accept `entity_name` in place of `address`,
  despite three sibling Profiler endpoints documenting that pattern -- it's an
  endpoint-by-endpoint opt-in, not Profiler-wide. Name-based Wallet Watch is an open
  problem again, see section 1C for the two untried directions
- Credit cost: 1 per call, including failures. `x-nansen-credits-remaining` IS a real
  header, but only appears on 200s, not on 4xx -- corrected from round one's
  incomplete read of this (see section 3.1)

Still open:
- Whether `tgm/transfers.transaction_type` ever holds anything besides `"transfer"` --
  the round-two call omitted the `include_cex`/`include_dex`/`non_exchange_transfers`
  filters (simplified out of the curl command, not a deliberate default-behavior test),
  so this sample may just not have exercised the richer path, not proof it doesn't exist
- Whether `chain: "all"` ever surfaces non-ethereum rows for a wallet that's active on
  multiple chains (the sampled Binance hot wallet's `"all"` page happened to be all
  ethereum too)
- Name-based Wallet Watch resolution (section 1C, both untried directions)
- Name-based Token Watch resolution via the unified `/api/v1/search` endpoint --
  neither Phase A round touched this at all
- The 15-unit rate-limit window observed in round one's headers, purpose still unclear

---

## 9. Build order

1. **Phase A -- verify. DONE**, two rounds. Real fields confirmed for all three event
   endpoints (sections A, A2, B). Two loose ends remain, both cheap, neither blocking:
   whether `tgm/transfers` ever produces a `transaction_type` besides `"transfer"`
   (needs the `filters` block actually populated in the request), and whether
   `chain: "all"` surfaces non-ethereum rows for a genuinely multi-chain wallet (the
   sample happened to be single-chain). Neither changes Phase B/C's design, just their
   completeness -- fine to run either as a quick aside, not a gate.
2. **Phase B -- define event semantics.** Section 1.5's direction-policy table is now
   written against real fields, not guessed ones -- lock it in as-is, including the
   `profiler/address/transactions` one-item-to-many-events wrinkle (section 5). The
   risk this phase existed to avoid -- building a technically correct normalizer that
   quietly forces every event back into a buy/sell shape -- didn't happen; the table
   confirms `buy`/`sell` really is the exception, produced only by the Trades filter.
3. **Phase C -- server clients + normalizers.** `nansen.js`: add `tokenTransfers()`,
   `tokenDexTrades()`, and `walletTransactions()` methods next to the existing
   `smartMoneyDexTrades()`. `normalize.js`: add the three normalizers from section 5,
   against the real response shapes and real semantics now on record -- including
   `normalizeWalletTransaction`'s array-returning shape and the `.flatMap()` change
   that implies in whatever calls it. Also the point to actually fix
   `web/src/mapper.js`'s `dir` line, and to build the retryable/non-retryable error
   split from section 3.1 into whatever polling code Phase D uses (and ideally back
   into `Poller` too).
4. **Phase D -- per-search WatchSession.** The `WatchSession` class (section 3), the
   `/api/watch/stream` route (section 4), wired into `server/index.js` alongside the
   existing `/api/stream`.
5. **Phase E -- search UI.** Section 6. Reuses the existing Simulation/reef-bridge/
   client pipeline entirely.
6. **Phase F -- entity resolution + labels + guardrails.** Section 1C's still-open
   name resolution (both directions untried), section 7's label lookup, plus the
   concurrent-session cap and poll-interval tuning from section 3.

Each phase is independently useful and independently resumable -- if this stops after
Phase C, the next session has working, tested normalizers with real semantics behind
them, and just needs to wire the route and UI around them.
