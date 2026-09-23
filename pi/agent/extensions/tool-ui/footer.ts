/**
 * tool-ui/footer.ts — 自定义状态栏
 *
 * 布局 (颜色全部走当前 pi 主题，即 palette):
 *   ● model · ● thinking | ⚑ cwd | git branch *N ?M | [████░░░░░░] | 7% used | 19.2k/1.0M
 *
 * 数据来源:
 * - ctx.model / ctx.thinkingLevel / ctx.cwd
 * - footerData.getGitBranch()
 * - ctx.getContextUsage() -> { tokens, contextWindow, percent }
 * - git 脏标记: 自己跑 `git status --porcelain`，2s 缓存，避免每帧都 spawn
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { execSync } from "node:child_process";
import { homedir } from "node:os";

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
