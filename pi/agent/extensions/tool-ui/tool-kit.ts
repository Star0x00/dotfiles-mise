/**
 * tool-ui/tool-kit.ts — 细线紧凑工具渲染工具箱
 *
 * 这里是唯一的样式来源。所有工具（内置 + 扩展）都通过 compactTool() 生成
 * renderCall/renderResult，因此改样式只需要动这一个文件。
 *
 * 折叠形态 (两行, 红绿灯单灯):
 *   ● Bash npm run build --verbose …
 *   ╰─ ◷ 0.10s · ⚙ ~31 words
 *
 * ctrl+e 展开完整输出 (│ 缩进)。
 * 状态灯: 黄=运行中、绿=成功、红=失败。参数超长会截断。
 *
 * 配置 (优先级: 项目 > 全局):
 * - ~/.pi/agent/tool-ui.json
 * - .pi/tool-ui.json
 * { "enabled": true, "maxExpandedLines": 200, "dimOutput": false }
 *
 * 旧文件名 droid-ui.json 仍会被读取 (向后兼容)。
 */

import { Text } from "@earendil-works/pi-tui";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeTheme, type PaletteOverrides, type ToolTheme } from "./theme/index.ts";

// ---------------------------------------------------------------- config

export interface ToolUiConfig {
  enabled: boolean;
  maxExpandedLines: number;
  dimOutput: boolean;
  /** 调用行参数最大字符数 (超出截断) */
  argMaxWidth?: number;
  /** "> 输入" 风格输入框 */
  editorPrompt?: boolean;
  /** 用户消息渲染成 "> 内容" 并去掉底色块 */
  userMessagePrompt?: boolean;
  /** 自定义状态栏 */
  statusLine?: boolean;
  /** "pi" | 内置 base16 名 | 内联 base16 对象 */
  palette?: string | Record<string, string>;
  colors?: PaletteOverrides;
  /** palette = "pi" 时恢复的 pi 主题名 */
  baseTheme?: string;
}

export const TOOL_UI_DEFAULTS: ToolUiConfig = {
  enabled: true,
  maxExpandedLines: 200,
  dimOutput: false,
  argMaxWidth: 90,
  editorPrompt: true,
  userMessagePrompt: true,
  statusLine: true,
};

const CONFIG_NAMES = ["tool-ui.json", "droid-ui.json"];

function configPaths(cwd: string): string[] {
  const out: string[] = [];
  for (const name of CONFIG_NAMES) {
    out.push(join(getAgentDir(), name));
    out.push(join(cwd, CONFIG_DIR_NAME, name));
  }
  return out;
}

export function loadToolUiConfig(cwd: string): ToolUiConfig {
  const cfg = { ...TOOL_UI_DEFAULTS };
  for (const p of configPaths(cwd)) {
    if (!existsSync(p)) continue;
    try {
      const j = JSON.parse(readFileSync(p, "utf-8"));
      if (typeof j?.enabled === "boolean") cfg.enabled = j.enabled;
      if (typeof j?.maxExpandedLines === "number") cfg.maxExpandedLines = j.maxExpandedLines;
      if (typeof j?.dimOutput === "boolean") cfg.dimOutput = j.dimOutput;
      if (typeof j?.argMaxWidth === "number") cfg.argMaxWidth = j.argMaxWidth;
      if (typeof j?.editorPrompt === "boolean") cfg.editorPrompt = j.editorPrompt;
      if (typeof j?.userMessagePrompt === "boolean") cfg.userMessagePrompt = j.userMessagePrompt;
      if (typeof j?.statusLine === "boolean") cfg.statusLine = j.statusLine;
      if (typeof j?.palette === "string" || (j?.palette && typeof j.palette === "object")) cfg.palette = j.palette;
      if (typeof j?.baseTheme === "string") cfg.baseTheme = j.baseTheme;
      if (j?.colors && typeof j.colors === "object") cfg.colors = { ...(cfg.colors ?? {}), ...j.colors };
    } catch {
      /* ignore malformed config */
    }
  }
  return cfg;
}

export function saveToolUiEnabled(enabled: boolean): void {
  saveToolUiConfig({ enabled });
}

/** 合并写入全局配置 (~/.pi/agent/tool-ui.json)。 */
export function saveToolUiConfig(patch: Record<string, unknown>): string {
  const p = join(getAgentDir(), "tool-ui.json");
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

// ---------------------------------------------------------------- text helpers

export const outputText = (result: any): string => {
  const c = result?.content?.[0];
  return typeof c?.text === "string" ? c.text : "";
};

export const isError = (result: any): boolean =>
  Boolean(result?.isError) || /^(Error|Access denied)/i.test(outputText(result));

export const finalize = (out: string): string => out.replace(/[ \t]+$/gm, "").replace(/\n+$/, "");

export function countLines(s: string): number {
  const t = s.trim();
  return t ? t.split("\n").length : 0;
}

export function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function humanBytes(n: number | undefined): string | undefined {
  if (typeof n !== "number" || n < 0) return undefined;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------- timing

export function elapsedSeconds(ctx: any): number | undefined {
  const s = ctx.state;
  if (ctx.executionStarted && s.t0 == null) s.t0 = Date.now();
  if (!ctx.isPartial && ctx.executionStarted && s.elapsed == null) {
    s.elapsed = Math.max(0, (Date.now() - (s.t0 ?? Date.now())) / 1000);
  }
  return s.elapsed;
}

export function fmtElapsed(sec: number | undefined): string | undefined {
  if (sec == null) return undefined;
  if (sec < 1) return `${sec.toFixed(2)}s`;
  if (sec < 10) return `${sec.toFixed(1)}s`;
  return `${Math.round(sec)}s`;
}

// ---------------------------------------------------------------- styles

export type Style = ToolTheme;

/** 用通用角色名建主题；cfg.palette / cfg.colors 可覆盖默认配色。 */
export function makeStyle(theme: any, cfg?: ToolUiConfig): Style {
  return makeTheme(theme, { palette: cfg?.palette, colors: cfg?.colors });
}

/** 红绿灯单灯: 运行中黄、成功绿、失败红。 */
export function trafficLight(st: Style, ctx: any, result?: any): string {
  const state = ctx.isPartial ? "running" : (result ? isError(result) : ctx.isError) ? "error" : "ok";
  if (state === "error") return st.error("●");
  if (state === "running") return st.warning("●");
  return st.success("●");
}

/** 单行化 + 截断参数，避免把整条命令都刷出来。 */
export function truncateArg(s: string, max?: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  const limit = max && max > 0 ? max : 90;
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, Math.max(1, limit - 1))}…`;
}

export function metaRow(st: Style, parts: (string | undefined)[]): string {
  const body = parts.filter((p): p is string => Boolean(p)).join(st.meta(" · "));
  return `${st.gutter("╰─")} ${body}`;
}

export function expandedBlock(st: Style, cfg: ToolUiConfig, out: string): string {
  const lines = finalize(out).split("\n");
  const shown = lines.slice(0, cfg.maxExpandedLines);
  const body = shown
    .map((l) => `${st.gutter("│ ")}${cfg.dimOutput ? st.meta(l) : st.output(l)}`)
    .join("\n");
  const tail =
    lines.length > cfg.maxExpandedLines
      ? `\n${st.gutter("│ ")}${st.metaStrong(`… +${lines.length - cfg.maxExpandedLines} lines`)}`
      : "";
  return `\n${body}${tail}`;
}

// ---------------------------------------------------------------- factory

export interface CompactToolSpec {
  /** 工具名标签，如 "Bash"、"Search" */
  label: string;
  /** 调用行显示的参数 */
  arg?: (args: any) => string;
  /** 结果行的指标片段（elapsed 会自动加在最前，错误会加在最后） */
  metrics?: (result: any, ctx: any, st: Style) => (string | undefined)[];
  /** 展开时的自定义内容；返回 undefined 则用默认的原文展开 */
  expanded?: (result: any, out: string, st: Style, cfg: ToolUiConfig) => string | undefined;
  /** 运行中的文案，默认 "running…" */
  runningText?: string;
}

/**
 * 生成一个紧凑工具渲染器。扩展注册工具时展开使用:
 *   pi.registerTool({ ...orig, name, ...compactTool({ label: "Search", ... }, cfg), execute })
 *
 * 每次渲染都会重读 tool-ui.json，所以改 palette / colors / maxExpandedLines 立即生效，
 * 不需要 /reload。
 */
export function compactTool(spec: CompactToolSpec, cfg: ToolUiConfig) {
  const cfgFor = (ctx: any): ToolUiConfig => {
    try {
      return loadToolUiConfig(ctx?.cwd ?? process.cwd());
    } catch {
      return cfg;
    }
  };
  return {
    renderShell: "self" as const,
    renderCall(args: any, theme: any, ctx: any): Text {
      const live = cfgFor(ctx);
      const st = makeStyle(theme, live);
      const head = `${trafficLight(st, ctx)} ${st.tool(spec.label)}`;
      const raw = spec.arg?.(args) ?? "";
      // 展开时显示完整参数 (不再截断)
      const arg = ctx.expanded ? raw.replace(/\s+/g, " ").trim() : truncateArg(raw, live.argMaxWidth);
      return new Text(arg ? `${head} ${st.arg(arg)}` : head, 0, 0);
    },
    renderResult(result: any, opts: any, theme: any, ctx: any): Text {
      const live = cfgFor(ctx);
      const st = makeStyle(theme, live);
      const out = finalize(outputText(result));
      const elapsed = fmtElapsed(elapsedSeconds(ctx));

      if (opts.isPartial && !out) {
        const running = spec.runningText ?? "running…";
        return new Text(
          `${st.gutter("╰─")} ${st.warning(running)}${elapsed ? st.meta(` · ◷ ${elapsed}`) : ""}`,
          0,
          0,
        );
      }

      const parts: (string | undefined)[] = [];
      if (elapsed) parts.push(st.meta(`◷ ${elapsed}`));
      if (spec.metrics) parts.push(...spec.metrics(result, ctx, st));
      if (isError(result) && !ctx.isPartial) {
        const first = out.split("\n").find((l: string) => l.trim()) ?? "error";
        parts.push(st.error(first));
      }

      let text = metaRow(st, parts);
      if (opts.expanded) {
        const custom = spec.expanded?.(result, out, st, live);
        if (custom !== undefined) text += custom;
        else if (out) text += expandedBlock(st, live, out);
      }
      return new Text(text, 0, 0);
    },
  };
}
