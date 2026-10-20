/**
 * tool-ui/footer.ts — 自定义状态栏
 *
 * 布局 (颜色全部走当前 pi 主题，即 palette):
 *   ● model · ● thinking | ⚑ cwd | git branch *N ?M | [████░░░░░░] | 7% used | 19.2k/1.0M | ¥3.25 | ● 42.0 tok/s
 *
 * 数据来源:
 * - ctx.model / ctx.thinkingLevel / ctx.cwd
 * - footerData.getGitBranch()
 * - ctx.getContextUsage() -> { tokens, contextWindow, percent }
 * - 会话累计费用: 遍历 ctx.sessionManager 的 entries 累加 usage.cost.total (按 entryCount/leafId 缓存)，
 *   汇率优先实时拉取 USD->CNY (6h 缓存)，失败则用 tool-ui.json 的 usdToCny (默认 7.2)
 * - git 脏标记: 自己跑 `git status --porcelain`，2s 缓存，避免每帧都 spawn
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { loadToolUiConfig } from "./tool-kit.ts";

/** 实时 USD->CNY 汇率: 先 frankfurter(ECB)，再 open.er-api。失败返回 undefined。 */
async function fetchUsdCny(): Promise<number | undefined> {
  const get = async (url: string): Promise<any> => {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  try {
    const j = await get("https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY");
    const v = j?.rates?.CNY;
    if (typeof v === "number" && v > 0) return v;
  } catch {
    /* fallthrough */
  }
  try {
    const j = await get("https://open.er-api.com/v6/latest/USD");
    const v = j?.rates?.CNY;
    if (typeof v === "number" && v > 0) return v;
  } catch {
    /* ignore */
  }
  return undefined;
}

function shortenCwd(cwd: string): string {
  const home = homedir();
  if (home && cwd.startsWith(home)) return `~${cwd.slice(home.length)}`;
  return cwd;
}

function fmtCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const BAR_CELLS = 10;

// 费用缓存失效版本号: 每轮结束 +1，确保新 entry 落地后重新统计
let costVersion = 0;

// ---- TPS (tokens per second) 追踪 ----
type TpsListener = () => void;
const tpsListeners = new Set<TpsListener>();
const tps = { streaming: false, startedAt: 0, chars: 0, last: 0 };

function notifyTps() {
  for (const l of tpsListeners) l();
}

/** 新一轮 assistant 输出开始 */
export function tpsBeginStream() {
  tps.streaming = true;
  tps.startedAt = Date.now();
  tps.chars = 0;
  notifyTps();
}

/** 收到一段流式文本 (字符数) */
export function tpsAddDelta(chars: number) {
  if (!tps.streaming || chars <= 0) return;
  tps.chars += chars;
  notifyTps();
}

/** 输出结束，优先用 provider 给的 output tokens 定稿 */
export function tpsEndStream(outputTokens?: number) {
  if (tps.streaming && tps.startedAt) {
    const secs = Math.max(0.05, (Date.now() - tps.startedAt) / 1000);
    const tokens = outputTokens && outputTokens > 0 ? outputTokens : tps.chars / 4;
    if (tokens > 0) tps.last = tokens / secs;
  }
  tps.streaming = false;
  costVersion++;
  notifyTps();
}

/** 当前 TPS：流式中用字符/4 估算，空闲时保留上一轮值 */
export function tpsCurrent(): number {
  if (tps.streaming && tps.startedAt) {
    const secs = Math.max(0.05, (Date.now() - tps.startedAt) / 1000);
    const v = tps.chars / 4 / secs;
    if (v > 0) return v;
  }
  return tps.last;
}

export function onTpsChange(cb: TpsListener): () => void {
  tpsListeners.add(cb);
  return () => tpsListeners.delete(cb);
}

export function statusLineFactory(ctx: ExtensionContext) {
  return (tui: any, theme: any, footerData: any) => {
    const unsub = footerData?.onBranchChange?.(() => tui.requestRender());
    const offTps = onTpsChange(() => tui.requestRender());

    // 会话累计费用缓存 (entryCount + leafId 变化才重新遍历)
    let costKey = "";
    let costValue = 0;
    let costSeenVersion = -1;

    // 汇率: 优先实时拉取 (缓存 6h)，失败回退 tool-ui.json 的 usdToCny
    let fallbackRate = 7.2;
    let fallbackAt = 0;
    let liveRate: number | undefined;
    let fetchedAt = 0;
    let fetching = false;
    const cnyRate = (): number => {
      const now = Date.now();
      if (now - fallbackAt >= 5000) {
        fallbackAt = now;
        try {
          fallbackRate = loadToolUiConfig(ctx.cwd).usdToCny ?? 7.2;
        } catch {
          fallbackRate = 7.2;
        }
      }
      if (!fetching && now - fetchedAt >= 6 * 3600_000) {
        fetching = true;
        void fetchUsdCny().then(
          (v) => {
            fetching = false;
            if (v) {
              liveRate = v;
              fetchedAt = Date.now();
              tui.requestRender();
            } else {
              fetchedAt = Date.now() - 6 * 3600_000 + 60_000; // 1 分钟后重试
            }
          },
          () => {
            fetching = false;
            fetchedAt = Date.now() - 6 * 3600_000 + 60_000;
          },
        );
      }
      return liveRate ?? fallbackRate;
    };
    const sessionCost = (): number => {
      const sm = ctx.sessionManager as any;
      if (!sm?.getEntries) return 0;
      const key = `${sm.getSessionId?.() ?? ""}:${sm.getLeafId?.() ?? ""}:${sm.getEntryCount?.() ?? 0}`;
      if (key === costKey && costSeenVersion === costVersion) return costValue;
      let cost = 0;
      const add = (u: any) => {
        if (u?.cost && typeof u.cost.total === "number") cost += u.cost.total;
      };
      for (const e of sm.getEntries()) {
        if (e.type === "usage") add(e.usage);
        else if (e.type === "message") {
          if (e.message?.role === "assistant") add(e.message.usage);
          else if (e.message?.role === "toolResult") add(e.message.usage);
        } else if (e.type === "branch_summary" || e.type === "compaction") add(e.usage);
      }
      costKey = key;
      costValue = cost;
      costSeenVersion = costVersion;
      return cost;
    };

    // git 脏标记缓存
    let dirtyAt = 0;
    let dirtyText = "";
    const gitDirty = (): string => {
      const now = Date.now();
      if (now - dirtyAt < 2000) return dirtyText;
      dirtyAt = now;
      try {
        const out = execSync("git --no-optional-locks status --porcelain", {
          cwd: ctx.cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 3000,
        });
        let modified = 0;
        let untracked = 0;
        for (const line of out.split("\n")) {
          if (!line.trim()) continue;
          if (line.startsWith("??")) untracked++;
          else modified++;
        }
        dirtyText = [modified ? `*${modified}` : "", untracked ? `?${untracked}` : ""].filter(Boolean).join(" ");
      } catch {
        dirtyText = "";
      }
      return dirtyText;
    };

    return {
      dispose: () => {
        unsub?.();
        offTps();
      },
      invalidate() {},
      render(width: number): string[] {
        const dot = (c: string) => theme.fg(c, "●");
        const sep = theme.fg("dim", " | ");

        // 第一组: 模型 · 思考级别
        const head: string[] = [`${dot("accent")} ${theme.fg("text", ctx.model?.id ?? ctx.model?.name ?? "no-model")}`];
        if (ctx.thinkingLevel) head.push(`${dot("accent")} ${theme.fg("muted", ctx.thinkingLevel)}`);
        const segments: string[] = [head.join(theme.fg("dim", " · "))];

        // cwd
        segments.push(`${theme.fg("dim", "⚑")} ${theme.fg("muted", shortenCwd(ctx.cwd))}`);

        // git
        const branch = footerData?.getGitBranch?.();
        if (branch) {
          const dirty = gitDirty();
          segments.push(
            `${theme.fg("dim", "git")} ${theme.fg("success", branch)}${dirty ? ` ${theme.fg("warning", dirty)}` : ""}`,
          );
        }

        // 上下文用量
        const usage = ctx.getContextUsage?.();
        if (usage && usage.contextWindow) {
          const pct = usage.percent ?? (usage.tokens ? (usage.tokens / usage.contextWindow) * 100 : 0);
          const clamped = Math.max(0, Math.min(100, pct));
          const filled = Math.round((clamped / 100) * BAR_CELLS);
          const bar =
            theme.fg("accent", "█".repeat(filled)) + theme.fg("dim", "░".repeat(BAR_CELLS - filled));
          segments.push(`[${bar}]`);
          segments.push(theme.fg(clamped >= 90 ? "error" : clamped >= 75 ? "warning" : "muted", `${Math.round(clamped)}% used`));
          const tok = `${fmtCount(usage.tokens ?? 0)}/${fmtCount(usage.contextWindow)}`;
          segments.push(theme.fg("dim", tok));
        }

        // 费用 (会话累计，按实时/回退汇率换算成人民币)
        const cost = sessionCost();
        if (cost > 0) {
          const cny = cost * cnyRate();
          segments.push(theme.fg("muted", cny >= 0.01 ? `¥${cny.toFixed(2)}` : "¥<0.01"));
        }

        // TPS (tokens/s)
        const tpsVal = tpsCurrent();
        if (tpsVal > 0) {
          segments.push(`${theme.fg("success", "●")} ${theme.fg("muted", `${tpsVal.toFixed(1)} tok/s`)}`);
        }

        return [truncateToWidth(segments.join(sep), width, "…")];
      },
    };
  };
}
