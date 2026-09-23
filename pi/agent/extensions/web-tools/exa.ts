/**
 * web-tools/exa.ts — Exa API 客户端 (只负责调用，不管显示)
 *
 * 搜索: POST https://api.exa.ai/search
 * 抓取: POST https://api.exa.ai/contents
 * 鉴权: header x-api-key (也支持 Authorization: Bearer)
 *
 * 配置 (优先级: 项目 > 全局 > 旧 rpiv 配置 > env):
 * - ~/.pi/agent/web-tools.json
 * - .pi/web-tools.json
 * - ~/.config/rpiv-web-tools/config.json  (旧配置，免重配)
 * 环境变量 EXA_API_KEY 优先级最高。
 *
 * {
 *   "exaApiKey": "xxxx",
 *   "type": "auto",            // instant|fast|auto|deep-lite|deep|deep-reasoning
 *   "numResults": 5,
 *   "maxCharacters": 1000000,
 *   "livecrawl": "fallback"    // never|fallback|always|preferred
 * }
 */

import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const EXA_CONTENTS_URL = "https://api.exa.ai/contents";
const DEFAULT_SNIPPET_CHARS = 300;

export interface ExaConfig {
  apiKey: string;
  type: string;
  numResults: number;
  maxCharacters: number;
  livecrawl: string;
  snippetCharacters: number;
}

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface FetchBundle {
  text: string;
  title?: string;
  contentType?: string;
  contentLength?: number;
}

// ---------------------------------------------------------------- config

function readJson(path: string): any {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
}

export function exaConfigPaths(cwd: string): string[] {
  const names = ["web-tools.json"];
  const out: string[] = [];
  for (const n of names) {
    out.push(join(homedir(), ".pi", "agent", n));
    out.push(join(cwd, ".pi", n));
  }
  return out;
}

export function loadExaConfig(cwd: string): ExaConfig {
  const cfg: ExaConfig = {
    apiKey: "",
    type: "auto",
    numResults: 5,
    maxCharacters: 1_000_000,
    livecrawl: "fallback",
    snippetCharacters: DEFAULT_SNIPPET_CHARS,
  };

  for (const p of exaConfigPaths(cwd)) {
    const j = readJson(p);
    if (!j) continue;
    if (typeof j.exaApiKey === "string") cfg.apiKey = j.exaApiKey;
    if (typeof j.apiKey === "string" && !cfg.apiKey) cfg.apiKey = j.apiKey;
    if (typeof j.type === "string") cfg.type = j.type;
    if (typeof j.numResults === "number") cfg.numResults = j.numResults;
    if (typeof j.maxCharacters === "number") cfg.maxCharacters = j.maxCharacters;
    if (typeof j.livecrawl === "string") cfg.livecrawl = j.livecrawl;
    if (typeof j.snippetCharacters === "number") cfg.snippetCharacters = j.snippetCharacters;
  }

  // 旧 rpiv-web-tools 配置 (免重配)
  const legacy = readJson(join(homedir(), ".config", "rpiv-web-tools", "config.json"));
  if (legacy) {
    if (typeof legacy?.apiKeys?.exa === "string" && !cfg.apiKey) cfg.apiKey = legacy.apiKeys.exa;
    if (legacy.provider === "exa" && typeof legacy.apiKey === "string" && !cfg.apiKey) cfg.apiKey = legacy.apiKey;
  }

  if (process.env.EXA_API_KEY) cfg.apiKey = process.env.EXA_API_KEY;
  return cfg;
}

export function requireExaApiKey(cfg: ExaConfig): string {
  if (!cfg.apiKey) {
    throw new Error(
      "Exa API key not set. Put EXA_API_KEY in the environment, or exaApiKey in ~/.pi/agent/web-tools.json.",
    );
  }
  return cfg.apiKey;
}

// ---------------------------------------------------------------- config write

export function webToolsConfigPath(): string {
  return join(homedir(), ".pi", "agent", "web-tools.json");
}

/** 合并写入全局配置 (~/.pi/agent/web-tools.json)，返回文件路径。 */
export function saveExaConfig(patch: Record<string, unknown>): string {
  const p = webToolsConfigPath();
  let cur: Record<string, unknown> = {};
  if (existsSync(p)) {
    try {
      cur = JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      /* ignore */
    }
  }
  writeFileSync(p, JSON.stringify({ ...cur, ...patch }, null, 2));
  return p;
}

export function maskKey(key: string): string {
  if (!key) return "(not set)";
  if (key.length <= 10) return `${key.slice(0, 2)}…`;
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

export const EXA_SEARCH_TYPES = ["instant", "fast", "auto", "deep-lite", "deep", "deep-reasoning"];
export const EXA_LIVECRAWL_MODES = ["never", "fallback", "always", "preferred"];

// ---------------------------------------------------------------- guards

export function assertHttpUrl(url: unknown): string {
  if (typeof url !== "string") throw new Error("url must be a string");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${String(url)}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Only http and https are supported: ${url}`);
  }
  return url;
}

// ---------------------------------------------------------------- Exa calls

function headers(apiKey: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-api-key": apiKey };
}

export interface SearchParams {
  query: string;
  numResults?: number;
  type?: string;
  category?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
}

export async function exaSearch(cfg: ExaConfig, params: SearchParams, signal?: AbortSignal): Promise<WebResult[]> {
  const body: Record<string, unknown> = {
    query: params.query,
    numResults: Math.min(100, Math.max(1, params.numResults ?? cfg.numResults)),
    type: params.type ?? cfg.type,
    contents: { text: { maxCharacters: cfg.snippetCharacters }, highlights: true },
  };
  if (params.category) body.category = params.category;
  if (params.includeDomains?.length) body.includeDomains = params.includeDomains;
  if (params.excludeDomains?.length) body.excludeDomains = params.excludeDomains;

  const res = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: headers(requireExaApiKey(cfg)),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Exa search error (${res.status}): ${await res.text()}`);

  const data: any = await res.json();
  return (data?.results ?? []).map((r: any): WebResult => {
    const snippet = r?.text ?? (Array.isArray(r?.highlights) ? r.highlights.join(" … ") : "") ?? "";
    return {
      title: r?.title ?? "",
      url: r?.url ?? "",
      snippet: typeof snippet === "string" ? snippet : "",
      publishedDate: r?.publishedDate ?? undefined,
    };
  });
}

export async function exaContents(cfg: ExaConfig, url: string, signal?: AbortSignal): Promise<FetchBundle> {
  const res = await fetch(EXA_CONTENTS_URL, {
    method: "POST",
    headers: headers(requireExaApiKey(cfg)),
    body: JSON.stringify({
      ids: [url],
      text: { maxCharacters: cfg.maxCharacters },
      livecrawl: cfg.livecrawl,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Exa contents error (${res.status}): ${await res.text()}`);

  const data: any = await res.json();
  const r = data?.results?.[0];
  if (!r?.text) throw new Error(`Exa returned no content for ${url}`);
  return { text: r.text, title: r.title || undefined, contentType: "text/plain" };
}

// ---------------------------------------------------------------- HTTP fallback

const HTML_STRIP_RULES: Array<[RegExp, string]> = [
  [/<script[\s\S]*?<\/script>/gi, ""],
  [/<style[\s\S]*?<\/style>/gi, ""],
  [/<noscript[\s\S]*?<\/noscript>/gi, ""],
  [/<\/(p|div|h[1-6]|li|tr|blockquote|pre|section|article|header|footer|nav|details|summary)>/gi, "\n"],
  [/<br\s*\/?>/gi, "\n"],
  [/<[^>]+>/g, " "],
];

export function htmlToText(html: string): string {
  let text = html;
  for (const [re, to] of HTML_STRIP_RULES) text = text.replace(re, to);
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)));
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function httpFetch(url: string, raw: boolean, signal?: AbortSignal): Promise<FetchBundle> {
  const res = await fetch(url, {
    signal,
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; pi/1.0)",
      Accept: "text/html,text/plain,application/json,*/*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (/^(image|video|audio)\//.test(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}. web_fetch supports text pages only.`);
  }
  const body = await res.text();
  const isHtml = contentType.includes("text/html");
  const lenHeader = res.headers.get("content-length");
  return {
    text: raw || !isHtml ? body : htmlToText(body),
    contentType: contentType || undefined,
    contentLength: lenHeader ? Number(lenHeader) : undefined,
  };
}

// ---------------------------------------------------------------- truncation

export function truncateForModel(text: string): { text: string; truncated: boolean; totalLines: number } {
  const t = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  if (!t.truncated) return { text: t.content, truncated: false, totalLines: t.totalLines };

  const tmp = join(tmpdir(), `pi-webfetch-${Date.now().toString(36)}.txt`);
  try {
    writeFileSync(tmp, text);
  } catch {
    /* ignore */
  }
  const footer =
    `\n\n[Output truncated: ${t.outputLines} of ${t.totalLines} lines ` +
    `(${formatSize(t.outputBytes)} of ${formatSize(t.totalBytes)}). Full output saved to: ${tmp}]`;
  return { text: t.content + footer, truncated: true, totalLines: t.totalLines };
}
