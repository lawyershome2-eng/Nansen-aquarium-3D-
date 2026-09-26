import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, U as redirect, _ as createRootRoute, d as Scripts, f as HeadContent, g as createFileRoute, h as Outlet, m as createRouter, v as useRouter, y as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-D2mbdTap.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-Bxux690r.css";
var APP_NAME = "Meridian Cinema";
var Route$5 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "theme-color",
				content: "#04101d"
			},
			{
				name: "description",
				content: "Smart-money trades swim through a living saltwater reef."
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var Route$4 = createFileRoute("/")({ beforeLoad: () => {
	throw redirect({
		href: "/reefscape/index.html",
		reloadDocument: true
	});
} });
var DEMO_TOKENS = [
	{
		symbol: "PEPE",
		name: "Pepe",
		chain: "ethereum",
		address: "0x6982508145454ce325ddbe47a25d4ec3d2311933"
	},
	{
		symbol: "LINK",
		name: "Chainlink",
		chain: "ethereum",
		address: "0x514910771af9ca656af840dff83e8264ecf986ca"
	},
	{
		symbol: "WETH",
		name: "Wrapped Ether",
		chain: "ethereum",
		address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
	},
	{
		symbol: "USDC",
		name: "USD Coin",
		chain: "ethereum",
		address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
	},
	{
		symbol: "AERO",
		name: "Aerodrome",
		chain: "base",
		address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631"
	},
	{
		symbol: "BNB",
		name: "BNB",
		chain: "bnb",
		address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c"
	},
	{
		symbol: "BONK",
		name: "Bonk",
		chain: "solana",
		address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
	},
	{
		symbol: "JUP",
		name: "Jupiter",
		chain: "solana",
		address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
	},
	{
		symbol: "SOL",
		name: "Wrapped SOL",
		chain: "solana",
		address: "So11111111111111111111111111111111111111112"
	}
];
var DEMO_ENTITIES = [
	{ name: "Binance" },
	{ name: "Coinbase" },
	{ name: "Jump Trading" },
	{ name: "Wintermute" }
];
var KNOWN_WALLETS = [{
	address: "0x28c6c06298d514db089934071355e5743bf21d60",
	label: "Binance"
}];
function tokenByAddress(address) {
	const a = address.toLowerCase();
	return DEMO_TOKENS.find((t) => t.address.toLowerCase() === a);
}
function knownLabel(address) {
	const a = address.toLowerCase();
	return KNOWN_WALLETS.find((w) => w.address.toLowerCase() === a)?.label ?? null;
}
function filterCatalog(query, chain) {
	const q = query.trim().toLowerCase();
	return {
		tokens: DEMO_TOKENS.filter((t) => {
			if (chain !== "all" && t.chain !== chain) return false;
			if (!q) return true;
			return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase() === q;
		}),
		entities: DEMO_ENTITIES.filter((e) => !q || e.name.toLowerCase().includes(q))
	};
}
var Seen = class {
	set = /* @__PURE__ */ new Set();
	q = [];
	cap;
	constructor(cap = 5e3) {
		this.cap = cap;
	}
	add(id) {
		if (this.set.has(id)) return false;
		this.set.add(id);
		this.q.push(id);
		if (this.q.length > this.cap) {
			const old = this.q.shift();
			if (old) this.set.delete(old);
		}
		return true;
	}
	filter(events) {
		return events.filter((e) => this.add(e.id));
	}
};
var CHAIN_SET = /* @__PURE__ */ new Set([
	"ethereum",
	"solana",
	"base",
	"arbitrum",
	"optimism",
	"polygon",
	"bnb",
	"avalanche",
	"all"
]);
var EVM$1 = /^0x[0-9a-fA-F]{40}$/;
var SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function addressOk(chain, address) {
	if (chain === "solana") return SOLANA.test(address);
	if (chain === "all") return EVM$1.test(address) || SOLANA.test(address);
	return EVM$1.test(address);
}
function shortAddr(address) {
	if (!address) return "unknown";
	if (address.length <= 12) return address;
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
function dateWindow(now = /* @__PURE__ */ new Date()) {
	const to = now.toISOString().slice(0, 10);
	return {
		from: (/* @__PURE__ */ new Date(now.getTime() - 5184e5)).toISOString().slice(0, 10),
		to
	};
}
function parseWatchQuery(params) {
	const mode = params.get("mode") || "";
	if (mode !== "wallet" && mode !== "token" && mode !== "entity") return {
		ok: false,
		error: "Pick a wallet, a token, or a name."
	};
	const chain = (params.get("chain") || "ethereum").trim().toLowerCase();
	if (!CHAIN_SET.has(chain)) return {
		ok: false,
		error: "That chain isn't on this feed."
	};
	const filterRaw = params.get("filter") || "all";
	if (filterRaw !== "all" && filterRaw !== "trades") return {
		ok: false,
		error: "Feed filter must be everything or trades."
	};
	const address = (params.get("address") || "").trim();
	const name = (params.get("name") || "").trim();
	const symbol = (params.get("symbol") || "").trim().slice(0, 32);
	if (mode === "entity") {
		if (name.length < 1 || name.length > 80) return {
			ok: false,
			error: "Enter a name to search."
		};
		return {
			ok: true,
			query: {
				mode,
				chain,
				address: "",
				name,
				symbol,
				filter: "all"
			}
		};
	}
	if (mode === "token" && chain === "all") return {
		ok: false,
		error: "Pick a single chain for a token."
	};
	if (!addressOk(chain, address)) return {
		ok: false,
		error: chain === "solana" ? "That doesn't look like a Solana address." : "That doesn't look like an address on this chain."
	};
	return {
		ok: true,
		query: {
			mode,
			chain,
			address,
			name: "",
			symbol,
			filter: mode === "token" ? filterRaw : "all"
		}
	};
}
function norm(s) {
	return s.trim().toLowerCase();
}
/** Prefer an exact symbol, then an exact entity name, then an exact token name. */
function rankSearch(query, tokens, entities, chain) {
	const q = norm(query);
	if (!q) return { kind: "none" };
	const symbol = preferChain(tokens.filter((t) => norm(t.symbol) === q), chain);
	if (symbol) return {
		kind: "token",
		token: symbol
	};
	const entity = entities.find((e) => norm(e.name) === q);
	if (entity) return {
		kind: "entity",
		name: entity.name
	};
	const named = preferChain(tokens.filter((t) => norm(t.name) === q), chain);
	if (named) return {
		kind: "token",
		token: named
	};
	const loose = tokens.map((t) => ({
		t,
		score: norm(t.symbol).startsWith(q) ? 2 : norm(t.name).startsWith(q) ? 1 : 0
	})).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
	if (loose.length && entities.length === 0) {
		const same = loose.filter((x) => x.score === loose[0].score).map((x) => x.t);
		const pick = preferChain(same, chain) || same[0];
		if (pick) return {
			kind: "token",
			token: pick
		};
	}
	if (entities[0]) return {
		kind: "entity",
		name: entities[0].name
	};
	return { kind: "none" };
}
function preferChain(list, chain) {
	if (!list.length) return void 0;
	if (chain && chain !== "all") {
		const hit = list.find((t) => t.chain === chain);
		if (hit) return hit;
	}
	return list[0];
}
function actorOf(address, label) {
	const clean = String(label ?? "").trim();
	let kind = "wallet";
	if (/fund/i.test(clean)) kind = "fund";
	else if (clean) kind = "smart";
	return {
		address: address || "",
		label: clean || shortAddr(address),
		kind
	};
}
function parseTs(s) {
	if (typeof s !== "string" || !s) return Date.now();
	const hasZone = /(Z|[+-]\d\d:?\d\d)$/.test(s);
	const t = Date.parse(hasZone ? s : `${s.replace(" ", "T")}Z`);
	return Number.isFinite(t) ? t : Date.now();
}
function num(v) {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}
function usdOf(value, price, amount) {
	const direct = num(value);
	if (direct != null && direct > 0) return Math.round(direct);
	const p = num(price);
	const a = num(amount);
	if (p != null && a != null && p >= 0) return Math.round(Math.abs(p * a));
	return direct != null && direct > 0 ? Math.round(direct) : 0;
}
var EVM = [
	{
		symbol: "PEPE",
		address: "0x6982508145454ce325ddbe47a25d4ec3d2311933"
	},
	{
		symbol: "LINK",
		address: "0x514910771af9ca656af840dff83e8264ecf986ca"
	},
	{
		symbol: "USDC",
		address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
	},
	{
		symbol: "WETH",
		address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
	}
];
var SOL = [
	{
		symbol: "BONK",
		address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
	},
	{
		symbol: "JUP",
		address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
	},
	{
		symbol: "SOL",
		address: "So11111111111111111111111111111111111111112"
	}
];
var DESKS = [
	{
		label: "Binance",
		address: "0x28c6c06298d514db089934071355e5743bf21d60"
	},
	{
		label: "Coinbase",
		address: "0x71660c4005ba85c37ccec55d0c4493e66fe775d3"
	},
	{
		label: "Uniswap",
		address: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad"
	},
	{
		label: "Wintermute",
		address: "0x00000000ae347930bd1e7b0f35588b92280f9e75"
	},
	{
		label: "Pantera Fund",
		address: "0x4a1e1416b0c1b8a1c0e5c0c0a0b0c0d0e0f0a1b2"
	},
	{
		label: "",
		address: "0x1111111111111111111111111111111111111111"
	}
];
function book(chain) {
	if (chain === "solana") return SOL;
	if (chain === "all") return [...EVM, ...SOL];
	return EVM;
}
function pick(rng, list) {
	return list[Math.floor(rng() * list.length)];
}
function usd(rng) {
	const r = rng();
	if (r < .72) return Math.round(10 ** (2.8 + rng() * 1.5));
	if (r < .94) return Math.round(10 ** (4.4 + rng() * 1.1));
	return Math.round(10 ** (5.7 + rng() * .7));
}
function demoAddressFor(name) {
	let x = 2166136261;
	const s = name.toLowerCase();
	for (let i = 0; i < s.length; i++) {
		x ^= s.charCodeAt(i);
		x = Math.imul(x, 16777619);
	}
	let out = "";
	for (let i = 0; i < 40; i++) {
		x = Math.imul(x ^ x >>> 15, 1831565813) >>> 0;
		out += (x & 15).toString(16);
	}
	return `0x${out.slice(0, 40)}`;
}
var DemoTide = class {
	subject;
	rng;
	n = 0;
	constructor(subject, rng = Math.random) {
		this.subject = subject;
		this.rng = rng;
	}
	batch(count) {
		return Array.from({ length: count }, () => this.one());
	}
	one() {
		this.n += 1;
		const chain = this.subject.chain === "all" ? this.rng() < .5 ? "ethereum" : "solana" : this.subject.chain;
		const watched = this.subject.address;
		const label = this.subject.label;
		const dollars = usd(this.rng);
		const id = `demo:${watched}:${this.n}:${Date.now()}`;
		if (this.subject.kind === "token") {
			const token = {
				symbol: label || "TOKEN",
				address: watched
			};
			if (this.subject.filter === "trades") {
				const side = this.rng() < .55 ? "buy" : "sell";
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
					metadata: {
						txHash: id,
						source: "demo"
					}
				};
			}
			const a = pick(this.rng, DESKS);
			let b = pick(this.rng, DESKS);
			if (b.address === a.address) b = DESKS[(DESKS.indexOf(a) + 1) % DESKS.length];
			return {
				id,
				timestamp: Date.now(),
				chain,
				usd: dollars,
				side: "transfer",
				token,
				from: actorOf(a.address, a.label),
				to: actorOf(b.address, b.label),
				metadata: {
					txHash: id,
					source: "demo",
					transactionType: "transfer"
				}
			};
		}
		const token = pick(this.rng, book(chain));
		const side = this.rng() < .5 ? "in" : "out";
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
			metadata: {
				txHash: id,
				source: "demo"
			}
		};
	}
};
var BASE = "https://api.nansen.ai";
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var NansenError = class extends Error {
	status;
	detail;
	constructor(status, path, detail) {
		super(`Nansen ${status} on ${path}: ${detail.slice(0, 300)}`);
		this.name = "NansenError";
		this.status = status;
		this.detail = detail.slice(0, 300);
	}
	get retryable() {
		return this.status === 429 || this.status >= 500;
	}
};
var NansenClient = class {
	apiKey;
	log;
	creditsRemaining = null;
	constructor(apiKey, log = console) {
		this.apiKey = apiKey;
		this.log = log;
		if (!apiKey) throw new Error("NANSEN_API_KEY missing");
	}
	async post(path, body, { retries = 2 } = {}) {
		for (let attempt = 0;; attempt++) {
			let res;
			try {
				res = await fetch(BASE + path, {
					method: "POST",
					headers: {
						apikey: this.apiKey,
						"Content-Type": "application/json"
					},
					body: JSON.stringify(body),
					signal: AbortSignal.timeout(2e4)
				});
			} catch (err) {
				if (attempt >= retries) throw err;
				await sleep(1e3 * 2 ** attempt);
				continue;
			}
			const rem = res.headers.get("x-nansen-credits-remaining");
			if (rem !== null && rem !== "") {
				const n = Number(rem);
				if (Number.isFinite(n)) this.creditsRemaining = n;
			}
			if (res.ok) return res.json();
			const retryable = res.status === 429 || res.status >= 500;
			const text = await res.text().catch(() => "");
			if (!retryable || attempt >= retries) throw new NansenError(res.status, path, text);
			const ra = Number(res.headers.get("retry-after"));
			const wait = Number.isFinite(ra) && ra > 0 ? ra * 1e3 : 1e3 * 2 ** attempt;
			this.log.warn(`Nansen ${res.status}, retrying in ${wait}ms`);
			await sleep(wait);
		}
	}
	tokenTransfers(args) {
		return this.post("/api/v1/tgm/transfers", {
			chain: args.chain,
			token_address: args.tokenAddress,
			date: {
				from: args.from,
				to: args.to
			},
			pagination: {
				page: 1,
				per_page: args.perPage ?? 40
			},
			filters: {
				include_cex: true,
				include_dex: true,
				non_exchange_transfers: true,
				only_smart_money: false
			},
			order_by: [{
				field: "block_timestamp",
				direction: "DESC"
			}]
		});
	}
	tokenDexTrades(args) {
		return this.post("/api/v1/tgm/dex-trades", {
			chain: args.chain,
			token_address: args.tokenAddress,
			only_smart_money: false,
			date: {
				from: args.from,
				to: args.to
			},
			pagination: {
				page: 1,
				per_page: args.perPage ?? 40
			},
			order_by: [{
				field: "block_timestamp",
				direction: "DESC"
			}]
		});
	}
	walletTransactions(args) {
		return this.post("/api/v1/profiler/address/transactions", {
			address: args.address,
			chain: args.chain,
			date: {
				from: args.from,
				to: args.to
			},
			hide_spam_token: true,
			pagination: {
				page: 1,
				per_page: args.perPage ?? 20
			},
			order_by: [{
				field: "block_timestamp",
				direction: "DESC"
			}]
		});
	}
	searchGeneral(query, resultType, chain) {
		return this.post("/api/v1/search/general", {
			search_query: query,
			result_type: resultType,
			limit: 12,
			...chain && chain !== "all" ? { chain } : {}
		});
	}
	searchEntityName(query) {
		return this.post("/api/v1/search/entity-name", { search_query: query });
	}
	addressLabels(address, chain) {
		return this.post("/api/v1/profiler/address/labels", {
			address,
			chain,
			pagination: {
				page: 1,
				per_page: 10
			}
		});
	}
};
var cachedKey = "";
var cached = null;
function getNansen() {
	const key = process.env.NANSEN_API_KEY?.trim() || "";
	if (!key) return null;
	if (key !== cachedKey || !cached) {
		cachedKey = key;
		cached = new NansenClient(key);
	}
	return cached;
}
function isRetryable(err) {
	if (err instanceof NansenError) return err.retryable;
	if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return true;
	return err instanceof TypeError;
}
function publicMessage(err) {
	if (err instanceof NansenError) {
		if (err.status === 401 || err.status === 403) return "Nansen refused the key.";
		if (err.status === 429) return "Nansen rate limit. Waiting to try again.";
		if (err.status >= 500) return "Nansen is unavailable. Waiting to try again.";
		const detail = err.detail.replace(/\s+/g, " ").trim().slice(0, 160);
		return detail ? `Nansen rejected the watch (${err.status}). ${detail}` : `Nansen rejected the watch (${err.status}).`;
	}
	if (err instanceof Error && err.name === "TimeoutError") return "Nansen took too long. Waiting to try again.";
	if (err instanceof Error && err.message) return err.message.slice(0, 180);
	return "Watch failed.";
}
function row(v) {
	return v && typeof v === "object" ? v : null;
}
function rowsOf(resp) {
	const data = row(resp)?.data;
	if (!Array.isArray(data)) return [];
	return data.map(row).filter((r) => r !== null);
}
function str(v) {
	return typeof v === "string" ? v : v == null ? "" : String(v);
}
function transferSide(transactionType) {
	const t = str(transactionType).toLowerCase();
	if (t === "buy") return "buy";
	if (t === "sell") return "sell";
	return "transfer";
}
function normalizeTokenTransfer(raw, ctx) {
	const hash = str(raw.transaction_hash);
	if (!hash) return null;
	const from = str(raw.from_address);
	const to = str(raw.to_address);
	const symbol = ctx.symbol || "TOKEN";
	return {
		id: [
			"transfer",
			ctx.chain,
			hash,
			from,
			to,
			str(raw.transfer_amount)
		].join(":"),
		timestamp: parseTs(raw.block_timestamp),
		chain: ctx.chain,
		usd: usdOf(raw.transfer_value_usd),
		side: transferSide(raw.transaction_type),
		token: {
			symbol,
			address: ctx.address
		},
		from: actorOf(from, raw.from_address_label),
		to: actorOf(to, raw.to_address_label),
		metadata: {
			txHash: hash,
			source: "nansen:tgm/transfers",
			transactionType: str(raw.transaction_type) || "transfer"
		}
	};
}
function normalizeTokenTransfers(resp, ctx) {
	return rowsOf(resp).map((r) => normalizeTokenTransfer(r, ctx)).filter((e) => e !== null);
}
function normalizeTokenTrade(raw) {
	const hash = str(raw.transaction_hash);
	if (!hash) return null;
	const action = str(raw.action).toUpperCase();
	const side = action === "SELL" ? "sell" : "buy";
	const tokenAddress = str(raw.token_address);
	const trader = str(raw.trader_address);
	return {
		id: [
			"trade",
			str(raw.chain),
			hash,
			trader,
			tokenAddress,
			str(raw.token_amount),
			action
		].join(":"),
		timestamp: parseTs(raw.block_timestamp),
		chain: str(raw.chain) || "ethereum",
		usd: usdOf(raw.estimated_value_usd),
		side,
		token: {
			symbol: str(raw.token_name) || "TOKEN",
			address: tokenAddress
		},
		from: actorOf(trader, raw.trader_address_label),
		to: null,
		metadata: {
			txHash: hash,
			source: "nansen:tgm/dex-trades",
			tradedToken: {
				symbol: str(raw.traded_token_name),
				address: str(raw.traded_token_address)
			}
		}
	};
}
function normalizeTokenTrades(resp) {
	return rowsOf(resp).map((r) => normalizeTokenTrade(r)).filter((e) => e !== null);
}
function legs(v) {
	if (!Array.isArray(v)) return [];
	return v.map(row).filter((r) => r !== null);
}
function normalizeWalletTransaction(raw, watchedAddress) {
	const hash = str(raw.transaction_hash);
	if (!hash) return [];
	const chain = str(raw.chain) || "ethereum";
	const ts = parseTs(raw.block_timestamp);
	const method = str(raw.method);
	const out = [];
	const push = (leg, side, index) => {
		const tokenAddress = str(leg.token_address);
		const symbol = str(leg.token_symbol) || (tokenAddress ? tokenAddress.slice(0, 6) : "TOKEN");
		if (!tokenAddress && !str(leg.token_symbol)) return;
		const from = str(leg.from_address) || (side === "out" ? watchedAddress : "");
		const to = str(leg.to_address) || (side === "in" ? watchedAddress : "");
		out.push({
			id: [
				"wallet",
				chain,
				hash,
				side,
				tokenAddress || symbol,
				String(index)
			].join(":"),
			timestamp: ts,
			chain: str(leg.chain) || chain,
			usd: usdOf(leg.value_usd, leg.price_usd, leg.token_amount),
			side,
			token: {
				symbol,
				address: tokenAddress
			},
			from: actorOf(from, leg.from_address_label),
			to: actorOf(to, leg.to_address_label),
			metadata: {
				txHash: hash,
				source: "nansen:profiler/address/transactions",
				transactionType: method || str(raw.source_type)
			}
		});
	};
	legs(raw.tokens_sent).forEach((leg, i) => push(leg, "out", i));
	legs(raw.tokens_received).forEach((leg, i) => push(leg, "in", i));
	if (!out.length) {
		const usd = Math.round(num(raw.volume_usd) ?? 0);
		if (usd <= 0) return [];
		out.push({
			id: [
				"wallet",
				chain,
				hash,
				"call"
			].join(":"),
			timestamp: ts,
			chain,
			usd,
			side: "transfer",
			token: {
				symbol: "TX",
				address: ""
			},
			from: actorOf(watchedAddress, ""),
			to: null,
			metadata: {
				txHash: hash,
				source: "nansen:profiler/address/transactions",
				transactionType: method || "call"
			}
		});
	}
	return out;
}
function normalizeWalletTransactions(resp, watchedAddress) {
	return rowsOf(resp).flatMap((r) => normalizeWalletTransaction(r, watchedAddress));
}
var MAX_SESSIONS = 6;
var LIVE_POLL_MS = 2e4;
var DEMO_POLL_MS = 2400;
var FIRST_BATCH = 8;
var WatchRejected = class extends Error {
	retryable = false;
	constructor(message) {
		super(message);
		this.name = "WatchRejected";
	}
};
function hub() {
	const g = globalThis;
	g.__meridianWatch ??= { sessions: /* @__PURE__ */ new Set() };
	return g.__meridianWatch;
}
function watchStats() {
	return {
		sessions: hub().sessions.size,
		live: Boolean(process.env.NANSEN_API_KEY?.trim())
	};
}
function asRecord(v) {
	return v && typeof v === "object" ? v : null;
}
function orderTokens(tokens, chain) {
	return [...tokens].sort((a, b) => Number(b.chain === chain) - Number(a.chain === chain));
}
function mapTokens(raw) {
	const list = asRecord(raw)?.tokens;
	if (!Array.isArray(list)) return [];
	const out = [];
	for (const item of list) {
		const t = asRecord(item);
		if (!t) continue;
		const address = String(t.address || "");
		const chain = String(t.chain || "");
		const symbol = String(t.symbol || "");
		const name = String(t.name || symbol);
		if (!address || !chain || !symbol) continue;
		out.push({
			symbol,
			name,
			chain,
			address
		});
	}
	return out;
}
function mapEntities(raw, fromNames) {
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	const push = (name) => {
		const n = name.trim();
		if (!n) return;
		const key = n.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		out.push({ name: n });
	};
	const list = asRecord(raw)?.entities;
	if (Array.isArray(list)) for (const item of list) {
		const e = asRecord(item);
		if (e) push(String(e.name || ""));
	}
	const data = asRecord(fromNames)?.data;
	if (Array.isArray(data)) for (const item of data) {
		const e = asRecord(item);
		if (e) push(String(e.entity_name || ""));
	}
	return out;
}
async function suggestWatch(query, chain) {
	const q = query.trim();
	const live = Boolean(getNansen());
	if (addressOk(chain, q) || addressOk("all", q)) return {
		live,
		tokens: [],
		entities: [],
		address: q
	};
	let tokens = [];
	let entities = [];
	if (!live) {
		const local = filterCatalog(q, "all");
		tokens = orderTokens(local.tokens, chain);
		entities = local.entities;
	} else {
		const client = getNansen();
		if (!client) throw new WatchRejected("Nansen isn't connected.");
		const names = client.searchEntityName(q).catch(() => ({ data: [] }));
		let general = await client.searchGeneral(q, "any", chain);
		tokens = mapTokens(general);
		if (!tokens.length && chain !== "all") {
			general = await client.searchGeneral(q, "any", "all");
			tokens = mapTokens(general);
		}
		entities = mapEntities(general, await names);
		tokens = orderTokens(tokens, chain);
	}
	return {
		live,
		tokens: tokens.slice(0, 8),
		entities: entities.slice(0, 8).map((e) => ({
			...e,
			watchable: !live
		})),
		address: null
	};
}
var WatchSession = class {
	query;
	emit;
	nansen;
	seen = new Seen();
	timers = /* @__PURE__ */ new Set();
	stopped = false;
	first = true;
	calls = 0;
	runtime = null;
	tide = null;
	live;
	constructor(query, emit, nansen) {
		this.query = query;
		this.emit = emit;
		this.nansen = nansen;
		this.live = Boolean(nansen);
	}
	start() {
		this.boot();
	}
	stop() {
		this.stopped = true;
		for (const t of this.timers) clearTimeout(t);
		this.timers.clear();
		hub().sessions.delete(this);
	}
	later(ms, fn) {
		const t = setTimeout(() => {
			this.timers.delete(t);
			if (!this.stopped) fn();
		}, ms);
		this.timers.add(t);
	}
	fail(err) {
		this.stopped = true;
		this.emit("status", {
			mode: this.live ? "live" : "demo",
			state: "error",
			subject: this.runtime?.label,
			error: err instanceof WatchRejected ? err.message : publicMessage(err)
		});
	}
	async boot() {
		try {
			await this.resolve();
		} catch (err) {
			if (!this.stopped && isRetryable(err)) {
				this.emit("status", {
					mode: "live",
					state: "degraded",
					error: publicMessage(err)
				});
				this.later(LIVE_POLL_MS, () => void this.boot());
				return;
			}
			this.fail(err);
			return;
		}
		if (this.stopped || !this.runtime) return;
		if (!this.runtime.watchable) {
			this.emit("status", {
				mode: this.live ? "live" : "demo",
				state: "idle",
				subject: this.runtime.label,
				note: this.runtime.note,
				error: null
			});
			this.stopped = true;
			return;
		}
		this.tide = new DemoTide(this.runtime);
		this.poll();
	}
	emitResolved() {
		const r = this.runtime;
		if (!r) return;
		this.emit("resolved", {
			kind: r.kind,
			label: r.label,
			chain: r.chain,
			address: r.address,
			watchable: r.watchable,
			note: r.note ?? null
		});
		this.emit("status", this.status("connecting"));
	}
	status(state, extra = {}) {
		return {
			mode: this.live ? "live" : "demo",
			state,
			subject: this.runtime?.label,
			note: this.runtime?.note ?? null,
			error: null,
			calls: this.calls,
			creditsRemaining: this.nansen?.creditsRemaining ?? null,
			...extra
		};
	}
	async resolve() {
		const q = this.query;
		if (q.mode === "wallet") {
			const label = !this.live && knownLabel(q.address) || q.symbol || shortAddr(q.address);
			this.runtime = {
				kind: "wallet",
				chain: q.chain,
				address: q.address,
				label,
				filter: "all",
				watchable: true,
				note: this.live ? void 0 : "Sample tide. A Nansen key turns this into the live feed."
			};
			this.emitResolved();
			return;
		}
		if (q.mode === "token") {
			let label = q.symbol || tokenByAddress(q.address)?.symbol || "";
			if (!label && this.nansen) try {
				const hits = mapTokens(await this.nansen.searchGeneral(q.address, "token", q.chain));
				const hit = hits.find((t) => t.address.toLowerCase() === q.address.toLowerCase()) || hits[0];
				if (hit?.symbol) label = hit.symbol;
			} catch {}
			this.runtime = {
				kind: "token",
				chain: q.chain,
				address: q.address,
				label: label || shortAddr(q.address),
				filter: q.filter,
				watchable: true,
				note: this.live ? void 0 : "Sample tide. A Nansen key turns this into the live feed."
			};
			this.emitResolved();
			return;
		}
		const found = this.live ? await this.resolveLiveName(q.name, q.chain) : this.resolveDemoName(q.name, q.chain);
		this.runtime = found;
		this.emitResolved();
	}
	resolveDemoName(name, chain) {
		const { tokens, entities } = filterCatalog(name, chain === "all" ? "all" : chain);
		const ranked = rankSearch(name, tokens.length ? tokens : filterCatalog(name, "all").tokens, entities.length ? entities : filterCatalog(name, "all").entities, chain);
		return this.runtimeFromRank(ranked, name, chain, false);
	}
	async resolveLiveName(name, chain) {
		const client = this.nansen;
		if (!client) throw new WatchRejected("Nansen isn't connected.");
		const names = client.searchEntityName(name).catch(() => ({ data: [] }));
		let general = await client.searchGeneral(name, "any", chain);
		let tokens = mapTokens(general);
		if (!tokens.length && chain !== "all") {
			general = await client.searchGeneral(name, "any", "all");
			tokens = mapTokens(general);
		}
		const entities = mapEntities(general, await names);
		return this.runtimeFromRank(rankSearch(name, tokens, entities, chain), name, chain, true);
	}
	runtimeFromRank(ranked, name, chain, live) {
		if (ranked.kind === "token") {
			const t = ranked.token;
			return {
				kind: "token",
				chain: t.chain,
				address: t.address,
				label: t.symbol,
				filter: "all",
				watchable: true,
				note: live ? void 0 : "Sample tide. A Nansen key turns this into the live feed."
			};
		}
		if (ranked.kind === "entity") {
			if (live) return {
				kind: "entity",
				chain,
				address: "",
				label: ranked.name,
				filter: "all",
				watchable: false,
				note: "Nansen won't give this name a wallet on the transactions feed. Paste a hot-wallet address."
			};
			return {
				kind: "entity",
				chain: chain === "all" ? "ethereum" : chain,
				address: demoAddressFor(ranked.name),
				label: ranked.name,
				filter: "all",
				watchable: true,
				note: "Sample tide for this name, not their real wallets. Paste a hot wallet to watch a real one."
			};
		}
		const local = !live ? rankSearch(name, DEMO_TOKENS, DEMO_ENTITIES, chain) : null;
		if (local && local.kind !== "none") return this.runtimeFromRank(local, name, chain, live);
		throw new WatchRejected(`Nothing matched “${name}”.`);
	}
	async fetchEvents() {
		const r = this.runtime;
		if (!r) return [];
		if (!this.nansen || !this.live) return this.tide?.batch(this.first ? FIRST_BATCH : 1) ?? [];
		const { from, to } = dateWindow();
		if (r.kind === "token" && r.filter === "trades") return normalizeTokenTrades(await this.nansen.tokenDexTrades({
			chain: r.chain,
			tokenAddress: r.address,
			from,
			to
		}));
		if (r.kind === "token") return normalizeTokenTransfers(await this.nansen.tokenTransfers({
			chain: r.chain,
			tokenAddress: r.address,
			from,
			to
		}), {
			chain: r.chain,
			address: r.address,
			symbol: r.label
		});
		return normalizeWalletTransactions(await this.nansen.walletTransactions({
			address: r.address,
			chain: r.chain,
			from,
			to
		}), r.address);
	}
	absorbLabels(events) {
		const r = this.runtime;
		if (!r || r.kind !== "wallet" && r.kind !== "entity") return;
		const addr = r.address.toLowerCase();
		for (const ev of events) for (const actor of [ev.from, ev.to]) {
			if (!actor) continue;
			if (actor.address.toLowerCase() === addr && actor.kind !== "wallet" && actor.label) {
				r.label = actor.label;
				return;
			}
		}
	}
	async poll() {
		if (this.stopped || !this.runtime) return;
		const pollMs = this.live ? LIVE_POLL_MS : DEMO_POLL_MS;
		try {
			const events = await this.fetchEvents();
			if (this.stopped) return;
			this.absorbLabels(events);
			let fresh = this.seen.filter(events).sort((a, b) => a.timestamp - b.timestamp);
			if (this.first) fresh = fresh.slice(-8);
			this.first = false;
			const gap = fresh.length ? Math.min(this.live ? 900 : 380, pollMs * .75 / fresh.length) : 0;
			fresh.forEach((ev, i) => this.later(i * gap, () => this.emit("cinema", ev)));
			this.calls += 1;
			this.emit("status", this.status("running"));
			this.later(pollMs, () => void this.poll());
		} catch (err) {
			if (this.stopped) return;
			if (isRetryable(err)) {
				this.emit("status", this.status("degraded", { error: publicMessage(err) }));
				this.later(pollMs, () => void this.poll());
				return;
			}
			this.fail(err);
		}
	}
};
function cinemaWatch(request) {
	const parsed = parseWatchQuery(new URL(request.url).searchParams);
	const encoder = new TextEncoder();
	let session = null;
	let hb;
	const stream = new ReadableStream({
		start(controller) {
			const emit = (event, data) => {
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					session?.stop();
				}
			};
			controller.enqueue(encoder.encode("retry: 10000\n\n"));
			if (!parsed.ok) {
				emit("status", {
					mode: "live",
					state: "error",
					error: parsed.error
				});
				return;
			}
			if (hub().sessions.size >= MAX_SESSIONS) {
				emit("status", {
					mode: "live",
					state: "error",
					error: "Too many watches are open right now. Close one and try again."
				});
				return;
			}
			session = new WatchSession(parsed.query, emit, getNansen());
			hub().sessions.add(session);
			session.start();
			hb = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": hb\n\n"));
				} catch {
					if (hb) clearInterval(hb);
				}
			}, 15e3);
			const drop = () => {
				if (hb) clearInterval(hb);
				session?.stop();
				try {
					controller.close();
				} catch {}
			};
			request.signal.addEventListener("abort", drop);
		},
		cancel() {
			if (hb) clearInterval(hb);
			session?.stop();
		}
	});
	return new Response(stream, { headers: {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no"
	} });
}
async function watchSuggestResponse(request) {
	const url = new URL(request.url);
	const q = (url.searchParams.get("q") || "").trim();
	const chain = (url.searchParams.get("chain") || "ethereum").trim().toLowerCase();
	if (!q || q.length > 200) return Response.json({
		live: Boolean(getNansen()),
		tokens: [],
		entities: [],
		address: null,
		error: "Enter a name or symbol."
	});
	try {
		const data = await suggestWatch(q, chain);
		return Response.json({
			...data,
			error: null
		});
	} catch (err) {
		return Response.json({
			live: Boolean(getNansen()),
			tokens: [],
			entities: [],
			address: null,
			error: err instanceof WatchRejected ? err.message : publicMessage(err)
		});
	}
}
var TOKENS = [
	[
		"SOL",
		"So11111111111111111111111111111111111111112",
		"solana"
	],
	[
		"JUP",
		"JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
		"solana"
	],
	[
		"BONK",
		"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
		"solana"
	],
	[
		"PEPE",
		"0x6982508145454ce325ddbe47a25d4ec3d2311933",
		"ethereum"
	],
	[
		"LINK",
		"0x514910771af9ca656af840dff83e8264ecf986ca",
		"ethereum"
	],
	[
		"AERO",
		"0x940181a94a35a4569e4529a3cdfb74e38fd98631",
		"base"
	]
];
var g = globalThis;
function state() {
	g.__meridianCinema ??= {
		recent: [],
		clients: /* @__PURE__ */ new Set(),
		started: false,
		n: 0
	};
	return g.__meridianCinema;
}
function mockEvent(big = false) {
	const s = state();
	const [symbol, address, chain] = TOKENS[Math.floor(Math.random() * TOKENS.length)];
	let usd = 10 ** (2.7 + Math.random() * (5.3 - 2.7));
	if (big) usd = 10 ** (6.3 + Math.random() * (7.1 - 6.3));
	else if (Math.random() < .03) usd *= 10;
	const fund = Math.random() < .15;
	const id = `mock:${Date.now()}:${s.n++}`;
	return {
		id,
		timestamp: Date.now(),
		chain,
		usd: Math.round(usd),
		side: Math.random() < .55 ? "buy" : "sell",
		token: {
			symbol,
			address
		},
		from: {
			address: "0x" + Math.random().toString(16).slice(2, 12).padEnd(10, "0"),
			label: fund ? "Fund" : "Smart Trader",
			kind: fund ? "fund" : "smart"
		},
		to: null,
		metadata: {
			txHash: id,
			source: "mock"
		}
	};
}
function publish(ev) {
	const s = state();
	s.recent.push(ev);
	if (s.recent.length > 200) s.recent.shift();
	const line = `event: cinema\ndata: ${JSON.stringify(ev)}\n\n`;
	for (const client of s.clients) try {
		client.enqueue(line);
	} catch {
		s.clients.delete(client);
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
function cinemaHealth() {
	const s = state();
	return Response.json({
		ok: true,
		mode: "mock",
		clients: s.clients.size,
		recent: s.recent.length,
		watch: watchStats()
	});
}
function cinemaStream(request) {
	ensureStarted();
	const s = state();
	const encoder = new TextEncoder();
	let hb;
	let client;
	const stream = new ReadableStream({
		start(controller) {
			const enqueue = (chunk) => controller.enqueue(encoder.encode(chunk));
			client = { enqueue };
			s.clients.add(client);
			enqueue("retry: 3000\n\n");
			enqueue(`event: status\ndata: ${JSON.stringify({
				mode: "mock",
				state: "running"
			})}\n\n`);
			for (const ev of s.recent.slice(-30)) enqueue(`event: cinema\ndata: ${JSON.stringify(ev)}\n\n`);
			hb = setInterval(() => {
				try {
					enqueue(": hb\n\n");
				} catch {
					if (hb) clearInterval(hb);
				}
			}, 15e3);
			const drop = () => {
				if (hb) clearInterval(hb);
				if (client) s.clients.delete(client);
				try {
					controller.close();
				} catch {}
			};
			request.signal.addEventListener("abort", drop);
		},
		cancel() {
			if (hb) clearInterval(hb);
			if (client) s.clients.delete(client);
		}
	});
	return new Response(stream, { headers: {
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache, no-transform",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no"
	} });
}
var Route$3 = createFileRoute("/api/health")({ server: { handlers: { GET: () => cinemaHealth() } } });
var Route$2 = createFileRoute("/api/stream")({ server: { handlers: { GET: ({ request }) => cinemaStream(request) } } });
var Route$1 = createFileRoute("/api/watch/stream")({ server: { handlers: { GET: ({ request }) => cinemaWatch(request) } } });
var Route = createFileRoute("/api/watch/suggest")({ server: { handlers: { GET: ({ request }) => watchSuggestResponse(request) } } });
var rootRouteChildren = {
	IndexRoute: Route$4.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$5
	}),
	ApiHealthRoute: Route$3.update({
		id: "/api/health",
		path: "/api/health",
		getParentRoute: () => Route$5
	}),
	ApiStreamRoute: Route$2.update({
		id: "/api/stream",
		path: "/api/stream",
		getParentRoute: () => Route$5
	}),
	ApiWatchStreamRoute: Route$1.update({
		id: "/api/watch/stream",
		path: "/api/watch/stream",
		getParentRoute: () => Route$5
	}),
	ApiWatchSuggestRoute: Route.update({
		id: "/api/watch/suggest",
		path: "/api/watch/suggest",
		getParentRoute: () => Route$5
	})
};
var routeTree = Route$5._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
	return createRouter({
		routeTree,
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { getRouter };
