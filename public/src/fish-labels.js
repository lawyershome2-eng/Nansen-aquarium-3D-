// Names for the trade fish. The reef renders them as a separate school; without
// a caption they are just extra chromis. Ambient reef fish stay unlabeled.

const SIDE = { buy: "buy", sell: "sell", in: "in", out: "out", transfer: "move" };

function clip(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function formatUsd(usd) {
  const value = Number(usd) || 0;
  if (value < 1) return "";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(value >= 1e7 ? 1 : 2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

function whoLine(ev) {
  const from = clip(ev?.from?.label, 22);
  const to = clip(ev?.to?.label, 22);
  if (ev?.side === "buy" || ev?.side === "sell") return from;
  if (from && to && from !== to) return `${from} → ${to}`;
  return from || to || "";
}

export function fishCaption(ev) {
  const symbol = clip(ev?.token?.symbol || "Token", 16);
  const side = SIDE[ev?.side] || "";
  const usd = formatUsd(ev?.usd);
  const meta = [side, usd].filter(Boolean).join(" · ");
  return { symbol, meta, who: whoLine(ev), side: ev?.side || "" };
}
