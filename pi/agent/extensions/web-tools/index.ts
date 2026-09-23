/**
 * web-tools — 联网搜索/抓取工具 (Exa)，只负责调用，不含任何样式
 *
 * 渲染交给 tool-ui 的 compactTool()，所以改外观不用动这里。
 *
 * 工具:
 * - web_search(query, num_results?, type?, category?, include_domains?, exclude_domains?)
 * - web_fetch(url, raw?)
 *
 * 配置与鉴权见 exa.ts。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  compactTool,
  humanBytes,
  loadToolUiConfig,
  type CompactToolSpec,
} from "../tool-ui/tool-kit.ts";
import {
  EXA_LIVECRAWL_MODES,
  EXA_SEARCH_TYPES,
  assertHttpUrl,
  exaContents,
  exaSearch,
  httpFetch,
  loadExaConfig,
  maskKey,
  saveExaConfig,
  truncateForModel,
  webToolsConfigPath,
  type WebResult,
} from "./exa.ts";

export default function webTools(pi: ExtensionAPI) {
  const uiCfg = loadToolUiConfig(process.cwd());

  // ---- web_search ----
  const searchSpec: CompactToolSpec = {
    label: "Search",
    runningText: "searching…",
    arg: (a) => (a?.query ? `"${a.query}"` : ""),
    metrics: (result, _ctx, st) => {
      const d = result?.details ?? {};
      const n = d.resultCount ?? d.results?.length ?? 0;
      const parts: (string | undefined)[] = [st.meta(`⌗ ${n} result${n === 1 ? "" : "s"}`)];
      if (d.backend) parts.push(st.meta(`@ ${d.backend}`));
      return parts;
    },
    expanded: (result, _out, st) => {
      const results: WebResult[] | undefined = result?.details?.results;
      if (!Array.isArray(results) || results.length === 0) return "";
      let text = "";
      for (const r of results.slice(0, 20)) {
        text += `\n${st.meta("│ ")}${st.metaStrong(`• ${r.title ?? ""}`)}${r.url ? st.meta(`  ${r.url}`) : ""}`;
      }
      return text;
    },
  };

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web with Exa. Returns titles, URLs, and snippets. Use for current information not in your training data.",
    promptSnippet: "Search the web for up-to-date information",
    promptGuidelines: [
      "Use web_search when you need recent events, current library versions, or live documentation not in training data.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query. Be specific and use natural language." }),
      num_results: Type.Optional(
        Type.Integer({ description: "Maximum number of results (1-10). Default: 5.", minimum: 1, maximum: 10 }),
      ),
      type: Type.Optional(
        Type.String({
          description:
            "Exa search mode: instant | fast | auto | deep-lite | deep | deep-reasoning. Default: auto (or config).",
        }),
      ),
      category: Type.Optional(
        Type.String({
          description:
            "Optional category focus: company | publication | news | personal site | financial report | people.",
        }),
      ),
      include_domains: Type.Optional(
        Type.Array(Type.String(), { description: "Only return results from these domains/paths." }),
      ),
      exclude_domains: Type.Optional(
        Type.Array(Type.String(), { description: "Exclude results from these domains/paths." }),
      ),
    }),
    ...compactTool(searchSpec, uiCfg),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const cfg = loadExaConfig(ctx.cwd);
      const query = String(params.query);
      onUpdate?.({
        content: [{ type: "text", text: `Searching Exa for: "${query}"…` }],
        details: { query, backend: "exa", resultCount: 0 },
      });

      const results = await exaSearch(
        cfg,
        {
          query,
          numResults: params.num_results,
          type: params.type,
          category: params.category,
          includeDomains: params.include_domains,
          excludeDomains: params.exclude_domains,
        },
        signal,
      );

      const details = { query, backend: "exa", resultCount: results.length, results };
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No results found for "${query}".` }], details };
      }
      const body = results
        .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`.trim())
        .join("\n\n");
      return { content: [{ type: "text", text: body }], details };
    },
  });

  // ---- web_fetch ----
  const fetchSpec: CompactToolSpec = {
    label: "Fetch",
    runningText: "fetching…",
    arg: (a) => a?.url ?? "",
    metrics: (result, _ctx, st) => {
      const d = result?.details ?? {};
      const parts: (string | undefined)[] = [];
      const size = humanBytes(d.contentLength);
      if (size) parts.push(st.meta(`▤ ${size}`));
      if (d.contentType) parts.push(st.meta(String(d.contentType).split(";")[0]));
      if (d.truncation?.truncated) parts.push(st.warning("✂ truncated"));
      return parts;
    },
  };

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch the content of a specific URL. Returns text content for HTML pages (tags stripped), raw text for plain text or JSON. Supports http and https only. Content is truncated to avoid overwhelming the context window.",
    promptSnippet: "Fetch and read content from a specific URL",
    promptGuidelines: ["Use web_fetch to read a specific URL found via web_search or provided by the user."],
    parameters: Type.Object({
      url: Type.String({ description: "The URL to fetch. Must be http or https." }),
      raw: Type.Optional(
        Type.Boolean({
          description: "If true, return the raw HTML instead of extracted text. Default: false.",
          default: false,
        }),
      ),
    }),
    ...compactTool(fetchSpec, uiCfg),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const url = assertHttpUrl(params.url);
      const raw = Boolean(params.raw);
      onUpdate?.({
        content: [{ type: "text", text: `Fetching: ${url}…` }],
        details: { url },
      });

      const cfg = loadExaConfig(ctx.cwd);
      let bundle;
      if (raw) {
        bundle = await httpFetch(url, true, signal);
      } else {
        try {
          bundle = await exaContents(cfg, url, signal);
        } catch {
          bundle = await httpFetch(url, false, signal);
        }
      }

      const trunc = truncateForModel(bundle.text);
      const details: Record<string, unknown> = {
        url,
        title: bundle.title,
        contentType: bundle.contentType,
        contentLength: bundle.contentLength ?? Buffer.byteLength(bundle.text, "utf-8"),
      };
      if (trunc.truncated) details.truncation = { truncated: true, totalLines: trunc.totalLines };

      const titleLine = bundle.title ? `${bundle.title}\n\n` : "";
      return { content: [{ type: "text", text: `${titleLine}${trunc.text}` }], details };
    },
  });

  // ---- /web-tools 命令 ----
  pi.registerCommand("web-tools", {
    description: "Exa 配置: (无参)状态 | key | type | num | max | livecrawl | test",
    handler: async (args, ctx) => {
      const argv = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = (argv.shift() ?? "").toLowerCase();
      const rest = argv.join(" ").trim();

      const status = (): string => {
        const c = loadExaConfig(ctx.cwd);
        const src = process.env.EXA_API_KEY ? "env EXA_API_KEY" : "config";
        return [
          "web-tools (Exa)",
          `key        ${maskKey(c.apiKey)}  [${src}]`,
          `type       ${c.type}`,
          `numResults ${c.numResults}`,
          `maxChars   ${c.maxCharacters}`,
          `livecrawl  ${c.livecrawl}`,
          `config     ${webToolsConfigPath()}`,
        ].join("\n");
      };

      if (!sub) {
        ctx.ui.notify(status(), "info");
        return;
      }

      switch (sub) {
        case "key": {
          let key = rest;
          if (!key) key = ((await ctx.ui.input("Exa API key", "exa-...")) ?? "").trim();
          if (!key) return;
          const p = saveExaConfig({ exaApiKey: key });
          ctx.ui.notify(
            process.env.EXA_API_KEY
              ? `已保存到 ${p}，但环境变量 EXA_API_KEY 优先级更高，实际仍用 env。`
              : `web-tools: 已保存 key 到 ${p}`,
            "info",
          );
          return;
        }
        case "type": {
          const v = rest;
          if (!EXA_SEARCH_TYPES.includes(v)) {
            ctx.ui.notify(`type 可选: ${EXA_SEARCH_TYPES.join(" | ")}`, "warning");
            return;
          }
          saveExaConfig({ type: v });
          ctx.ui.notify(`web-tools: type = ${v}`, "info");
          return;
        }
        case "num":
        case "numresults": {
          const n = Number(rest);
          if (!Number.isFinite(n) || n < 1 || n > 100) {
            ctx.ui.notify("num 需为 1-100 的整数", "warning");
            return;
          }
          saveExaConfig({ numResults: Math.round(n) });
          ctx.ui.notify(`web-tools: numResults = ${Math.round(n)}`, "info");
          return;
        }
        case "max":
        case "maxchars": {
          const n = Number(rest);
          if (!Number.isFinite(n) || n < 1000) {
            ctx.ui.notify("max 需为 >=1000 的整数 (字符数)", "warning");
            return;
          }
          saveExaConfig({ maxCharacters: Math.round(n) });
          ctx.ui.notify(`web-tools: maxCharacters = ${Math.round(n)}`, "info");
          return;
        }
        case "livecrawl": {
          const v = rest;
          if (!EXA_LIVECRAWL_MODES.includes(v)) {
            ctx.ui.notify(`livecrawl 可选: ${EXA_LIVECRAWL_MODES.join(" | ")}`, "warning");
            return;
          }
          saveExaConfig({ livecrawl: v });
          ctx.ui.notify(`web-tools: livecrawl = ${v}`, "info");
          return;
        }
        case "test": {
          const query = rest || "pi coding agent";
          const c = loadExaConfig(ctx.cwd);
          try {
            const results = await exaSearch(c, { query, numResults: 3 });
            ctx.ui.notify(`web-tools: ok · "${query}" 返回 ${results.length} 条`, "info");
          } catch (err) {
            ctx.ui.notify(`web-tools: 失败 - ${err instanceof Error ? err.message : String(err)}`, "error");
          }
          return;
        }
        default:
          ctx.ui.notify(
            "用法: /web-tools [key [值] | type <mode> | num <1-100> | max <字符> | livecrawl <mode> | test [query]]",
            "info",
          );
      }
    },
  });
}
