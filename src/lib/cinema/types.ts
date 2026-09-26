// CinemaEvent is the only shape the reef, the 2D pipeline, and the bridge consume.
// Watch Mode must not leak Nansen's raw rows past the normalizers.

export type ActorKind = "fund" | "smart" | "wallet";

export type Side = "buy" | "sell" | "in" | "out" | "transfer";

export type Actor = {
  address: string;
  label: string;
  kind: ActorKind;
};

export type CinemaEvent = {
  id: string;
  timestamp: number;
  chain: string;
  usd: number;
  side: Side;
  token: { symbol: string; address: string };
  from: Actor;
  to: Actor | null;
  metadata: {
    txHash: string;
    source: string;
    transactionType?: string;
    tradedToken?: { symbol: string; address: string };
  };
};
