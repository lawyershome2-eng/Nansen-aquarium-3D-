// Mock smart-money clock. One loop per server process; every viewer shares it.

import { watchStats } from "./watch.server.ts";

type CinemaEvent = {
  id: string;
  timestamp: number;
  chain: string;
  usd: number;
  side: "buy" | "sell";
  token: { symbol: string; address: string };
  from: { address: string; label: string; kind: "fund" | "smart" };
  to: null;
  metadata: { txHash: string; source: "mock" };
};

type Client = { enqueue: (chunk: string) => void };

const TOKENS: Array<[string, string, string]> = [
  ["SOL", "So11111111111111111111111111111111111111112", "solana"],
  ["JUP", "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", "solana"],
  ["BONK", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", "solana"],
  ["PEPE", "0x6982508145454ce325ddbe47a25d4ec3d2311933", "ethereum"],
  ["LINK", "0x514910771af9ca656af840dff83e8264ecf986ca", "ethereum"],
  ["AERO", "0x940181a94a35a4569e4529a3cdfb74e38fd98631", "base"],
];

const g = globalThis as typeof globalThis & {
  __meridianCinema?: {
    recent: CinemaEvent[];
    clients: Set<Client>;
    started: boolean;
    n: number;
  };
};

function state() {
  g.__meridianCinema ??= { recent: [], clients: new Set(), started: false, n: 0 };
  return g.__meridianCinema;
}

function mockEvent(big = false): CinemaEvent {
  const s = state();
  const [symbol, address, chain] = TOKENS[Math.floor(Math.random() * TOKENS.length)]!;
  let usd = 10 ** (2.7 + Math.random() * (5.3 - 2.7));
  if (big) usd = 10 ** (6.3 + Math.random() * (7.1 - 6.3));
  else if (Math.random() < 0.03) usd *= 10;
  const fund = Math.random() < 0.15;
  const id = `mock:${Date.now()}:${s.n++}`;
  return {
    id,
    timestamp: Date.now(),
    chain,
    usd: Math.round(usd),
    side: Math.random() < 0.55 ? "buy" : "sell",
    token: { symbol, address },
    from: {
      address: "0x" + Math.random().toString(16).slice(2, 12).padEnd(10, "0"),
      label: fund ? "Fund" : "Smart Trader",
      kind: fund ? "fund" : "smart",
    },
    to: null,
    metadata: { txHash: id, source: "mock" },
  };
}

function publish(ev: CinemaEvent) {
  const s = state();
  s.recent.push(ev);
  if (s.recent.length > 200) s.recent.shift();
  const line = `event: cinema\ndata: ${JSON.stringify(ev)}\n\n`;
  for (const client of s.clients) {
    try {
      client.enqueue(line);
    } catch {
      s.clients.delete(client);
    }
  }
}

function ensureStarted() {
  const s = state();
  if (s.started) return;
  s.started = true;
  let count = 0;
  const tick = () => {
    count += 1;
    publish(mockEvent(count % 45 === 0));
    setTimeout(tick, 600 + Math.random() * 1800);
  };
  tick();
}

export function cinemaHealth(): Response {
  const s = state();
  return Response.json({
    ok: true,
    mode: "mock",
    clients: s.clients.size,
    recent: s.recent.length,
    watch: watchStats(),
  });
}

export function cinemaStream(request: Request): Response {
  ensureStarted();
  const s = state();
  const encoder = new TextEncoder();
  let hb: ReturnType<typeof setInterval> | undefined;
  let client: Client | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      client = { enqueue };
      s.clients.add(client);
      enqueue("retry: 3000\n\n");
      enqueue(
        `event: status\ndata: ${JSON.stringify({ mode: "mock", state: "running" })}\n\n`,
      );
      for (const ev of s.recent.slice(-30)) {
        enqueue(`event: cinema\ndata: ${JSON.stringify(ev)}\n\n`);
      }
      hb = setInterval(() => {
        try {
          enqueue(": hb\n\n");
        } catch {
          if (hb) clearInterval(hb);
        }
      }, 15000);
      const drop = () => {
        if (hb) clearInterval(hb);
        if (client) s.clients.delete(client);
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
      if (client) s.clients.delete(client);
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
