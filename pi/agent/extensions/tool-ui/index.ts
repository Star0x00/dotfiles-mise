/**
 * tool-ui — 工具紧凑渲染 + 全局配色
 *
 * 1) 工具渲染: 同名 registerTool 覆盖内建工具，execute 委托原实现，样式来自 tool-kit.ts。
 *    覆盖: bash read write edit grep find ls
 * 2) 全局主题: 选了 base16 配色 (palette) 时，同时构造完整 pi Theme 并 setTheme，
 *    整个界面 (消息/编辑器/markdown/语法高亮) 跟随同一套配色。
 *
 * /tool-ui on|off|list|colors|palette <名>
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from "@earendil-works/pi-coding-agent";
import {
  type CompactToolSpec,
  compactTool,
  countLines,
  countWords,
  finalize,
  loadToolUiConfig,
  outputText,
  saveToolUiConfig,
  saveToolUiEnabled,
} from "./tool-kit.ts";
import { buildPiTheme, buildPiThemeColors, describePalette, listPalettes, paletteScheme, previewPalette, setSettingsTheme, writePiThemeFile } from "./theme/index.ts";
import { PromptEditor } from "./editor.ts";
import { statusLineFactory, tpsAddDelta, tpsBeginStream, tpsEndStream } from "./footer.ts";

// ---------------------------------------------------------------- arg lines

function readArg(a: any): string {
  let s = a?.path ?? "";
  const notes: string[] = [];
  if (a?.offset) notes.push(`offset=${a.offset}`);
  if (a?.limit) notes.push(`limit=${a.limit}`);
  if (notes.length) s += ` (${notes.join(", ")})`;
  return s;
}

function editStats(result: any): { add: number; del: number } {
  const diff: string = result?.details?.diff ?? "";
  const add = diff.split("\n").filter((l: string) => l.startsWith("+") && !l.startsWith("+++")).length;
  const del = diff.split("\n").filter((l: string) => l.startsWith("-") && !l.startsWith("---")).length;
  return { add, del };
}

// ---------------------------------------------------------------- extension

export default function toolUi(pi: ExtensionAPI) {
  const cfg = loadToolUiConfig(process.cwd());
  if (!cfg.enabled) return;

  const cwd = process.cwd();

  const specs: Record<string, CompactToolSpec & { orig: any }> = {
    bash: {
      orig: createBashTool(cwd),
      label: "Bash",
      arg: (a) => a?.command ?? "",
      runningText: "running…",
      metrics: (result, ctx, st) => {
        const out = finalize(outputText(result));
        const parts: (string | undefined)[] = [];
        if (ctx.args?.timeout) parts.push(st.meta(`■ ${ctx.args.timeout}s`));
        const words = countWords(out);
        if (words) parts.push(st.meta(`⚙ ~${words} words`));
        return parts;
      },
    },
    read: {
      orig: createReadTool(cwd),
      label: "Read",
      arg: readArg,
      runningText: "reading…",
      metrics: (result, _ctx, st) => {
        const parts: (string | undefined)[] = [];
        const n = countLines(outputText(result));
        if (n) parts.push(st.meta(`▤ ${n} lines`));
        const t = result?.details?.truncation;
        if (t?.truncated) parts.push(st.warning(`✂ truncated from ${t.totalLines}`));
        return parts;
      },
    },
    write: {
      orig: createWriteTool(cwd),
      label: "Write",
      arg: (a) => `${a?.path ?? ""} (${(a?.content ?? "").split("\n").length}L)`,
      runningText: "writing…",
      metrics: (result, _ctx, st) => {
        const n = countLines(outputText(result));
        return n ? [st.meta(`▤ ${n} lines`)] : [];
      },
    },
    edit: {
      orig: createEditTool(cwd),
      label: "Edit",
      arg: (a) => a?.path ?? "",
      runningText: "editing…",
      metrics: (result, _ctx, st) => {
        const { add, del } = editStats(result);
        return add || del ? [`${st.added(`+${add}`)} ${st.removed(`-${del}`)}`] : [];
      },
    },
    grep: {
      orig: createGrepTool(cwd),
      label: "Grep",
      arg: (a) => [a?.pattern, a?.path].filter(Boolean).join(" "),
      runningText: "searching…",
      metrics: (result, _ctx, st) => {
        const n = countLines(outputText(result));
        return n ? [st.meta(`⌗ ${n} matches`)] : [];
      },
    },
    find: {
      orig: createFindTool(cwd),
      label: "Find",
      arg: (a) => [a?.pattern, a?.path].filter(Boolean).join(" "),
      runningText: "finding…",
      metrics: (result, _ctx, st) => {
        const n = countLines(outputText(result));
        return n ? [st.meta(`⌗ ${n} matches`)] : [];
      },
    },
    ls: {
      orig: createLsTool(cwd),
      label: "List",
      arg: (a) => a?.path ?? ".",
      runningText: "listing…",
      metrics: (result, _ctx, st) => {
        const n = countLines(outputText(result));
        return n ? [st.meta(`⌗ ${n} entries`)] : [];
      },
    },
  };

  for (const [name, spec] of Object.entries(specs)) {
    const { orig, ...renderSpec } = spec;
    pi.registerTool({
      ...orig,
      name,
      ...compactTool(renderSpec, cfg),
      async execute(toolCallId: any, params: any, signal: any, onUpdate: any) {
        return orig.execute(toolCallId, params, signal, onUpdate);
      },
    });
  }

  // ---- 整体主题：palette 同时驱动 pi 全量配色 ----
  // 同时落盘主题文件 + 把 settings.json 的 theme 指过去，
  // 这样 pi 在 /reload 等时机重置主题时，会从 settings 恢复成我们的主题。
  const applyTheme = (
    ctx: any,
    cfg: { palette?: string | Record<string, string>; userMessagePrompt?: boolean },
    opts: { persist?: boolean } = {},
  ): string | undefined => {
    const scheme = paletteScheme(cfg.palette);
    if (!scheme) return undefined;
    const name = typeof cfg.palette === "string" ? `tool-ui-${cfg.palette}` : "tool-ui-inline";
    if (opts.persist) {
      try {
        writePiThemeFile(name, buildPiThemeColors(scheme, { userMessagePrompt: cfg.userMessagePrompt }));
        setSettingsTheme(name);
      } catch {
        /* 落盘失败不影响本次会话 */
      }
    }
    const res = ctx.ui.setTheme(buildPiTheme(scheme, { name, userMessagePrompt: cfg.userMessagePrompt }));
    if (res && res.success === false) return res.error ?? "setTheme failed";
    return undefined;
  };

  // 用户消息渲染成 "❯ 内容" (底色块由主题去掉)
  if (cfg.userMessagePrompt !== false) {
    pi.registerMarkdownTransformer((markdown, { messageType }) => {
      if (messageType !== "user") return markdown;
      const lines = markdown.split("\n");
      // 用行内代码包住箭头，让它走 mdCode 颜色，和正文区分开
      return lines.map((l, i) => (i === 0 ? `\`❯\` ${l}` : l)).join("\n");
    });
  }

  // TPS 追踪
  pi.on("message_start", (event) => {
    if (event.message.role === "assistant") tpsBeginStream();
  });
  pi.on("message_update", (event) => {
    const ev = event.assistantMessageEvent as { type?: string; delta?: string } | undefined;
    if (ev && typeof ev.delta === "string" && (ev.type === "text_delta" || ev.type === "thinking_delta" || ev.type === "toolcall_delta")) {
      tpsAddDelta(ev.delta.length);
    }
  });
  pi.on("message_end", (event) => {
    if (event.message.role === "assistant") tpsEndStream((event.message as any).usage?.output);
  });

  // 应用/重新应用整套 UI 设置。
  // /reload 后 pi 会重置回 settings 里的主题，所以除了 session_start，
  // 每轮开始前 (before_agent_start) 也重放一次，保证 palette 主题真正生效。
  let uiApplied = false;
  const reapplyUi = (ctx: any, opts: { saveBase?: boolean; persist?: boolean } = {}) => {
    const live = loadToolUiConfig(ctx.cwd);
    if (opts.saveBase) {
      const currentName = (ctx.ui.theme as any)?.name;
      // 不要把我们自己生成的主题当成 baseTheme
      if (!live.baseTheme && currentName && !String(currentName).startsWith("tool-ui-")) {
        saveToolUiConfig({ baseTheme: currentName });
      }
    }
    // 主题每轮都重放：/reload 会把 pi 主题重置回 settings 里的那个
    applyTheme(ctx, live, { persist: opts.persist });

    // 编辑器/状态栏只需装一次 (避免每轮重建编辑器丢草稿)
    if (!uiApplied) {
      uiApplied = true;
      if (live.editorPrompt === true) {
        ctx.ui.setEditorComponent((tui: any, theme: any, kb: any) => new PromptEditor(tui, theme, kb, { embedWorkingStatus: true }));
      }
      if (live.statusLine !== false) ctx.ui.setFooter(statusLineFactory(ctx));
    }
  };

  pi.on("session_start", (_event, ctx) => reapplyUi(ctx, { saveBase: true, persist: true }));
  pi.on("before_agent_start", (_e, ctx) => reapplyUi(ctx));

  // 模型 / 思考级别变化时刷新状态栏上下文
  pi.on("model_select", (_e, ctx) => reapplyUi(ctx));
  pi.on("thinking_level_select", (_e, ctx) => reapplyUi(ctx));

  pi.registerCommand("tool-ui", {
    description: "工具紧凑渲染开关 (需 /reload 生效)",
    handler: async (args, ctx) => {
      const argv = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = (argv.shift() ?? "").toLowerCase();
      if (sub === "on" || sub === "enable") {
        saveToolUiEnabled(true);
        ctx.ui.notify("tool-ui: 已开启 (需要 /reload 生效)", "info");
        return;
      }
      if (sub === "off" || sub === "disable") {
        saveToolUiEnabled(false);
        ctx.ui.notify("tool-ui: 已关闭 (需要 /reload 生效)", "info");
        return;
      }
      if (sub === "list" || sub === "palettes" || (sub === "palette" && argv.length === 0)) {
        const raw = loadToolUiConfig(ctx.cwd).palette;
        const cur = typeof raw === "string" && raw ? raw : "pi";
        const lines = listPalettes().map((n) => {
          const mark = n === cur ? "→ " : "  ";
          return `${mark}${n.padEnd(18)} ${previewPalette(n, ctx.ui.theme)}`;
        });
        ctx.ui.notify(`tool-ui 配色 (当前: ${cur})\n${lines.join("\n")}\n\n切换: /tool-ui palette <名>`, "info");
        return;
      }
      if (sub === "colors" || sub === "palette" || sub === "theme") {
        if (argv.length && sub === "palette") {
          const name = argv[0];
          if (!listPalettes().includes(name)) {
            ctx.ui.notify(`tool-ui: 未知配色。可选: ${listPalettes().join(", ")}`, "warning");
            return;
          }
          saveToolUiConfig({ palette: name });
          const live = loadToolUiConfig(ctx.cwd);
          let note = "";
          if (name === "pi") {
            const base = live.baseTheme ?? "dark";
            setSettingsTheme(base);
            const res = ctx.ui.setTheme(base);
            if (res && res.success === false) note = `(恢复主题失败: ${res.error ?? "?"})`;
          } else {
            const err = applyTheme(ctx, { ...live, palette: name }, { persist: true });
            if (err) note = `(应主题失败: ${err})`;
          }
          ctx.ui.notify(
            `tool-ui: palette = ${name}  (工具渲染 + 整体主题，立即生效)${note ? ` ${note}` : ""}\n\n${describePalette({ palette: name })}`,
            "info",
          );
          return;
        }
        if (sub === "palette") {
          ctx.ui.notify(`tool-ui: 用法 /tool-ui palette <名>，可选: ${listPalettes().join(", ")}`, "info");
          return;
        }
        ctx.ui.notify(`tool-ui 配色:\n${describePalette(loadToolUiConfig(ctx.cwd))}\n\n切换: /tool-ui palette <名>`, "info");
        return;
      }
      if (sub === "editor") {
        const v = (argv[0] ?? "").toLowerCase();
        if (v === "on" || v === "off") {
          saveToolUiConfig({ editorPrompt: v === "on" });
          if (v === "on") {
            ctx.ui.setEditorComponent((tui: any, theme: any, kb: any) => new PromptEditor(tui, theme, kb, { embedWorkingStatus: true }));
          } else {
            ctx.ui.setEditorComponent(undefined);
          }
          ctx.ui.notify(`tool-ui: editor ${v}`, "info");
          return;
        }
        ctx.ui.notify(
          `tool-ui: editor = ${loadToolUiConfig(ctx.cwd).editorPrompt === false ? "off" : "on"}  (/tool-ui editor on|off)`,
          "info",
        );
        return;
      }
      if (sub === "statusline" || sub === "status") {
        const v = (argv[0] ?? "").toLowerCase();
        if (v === "on" || v === "off") {
          saveToolUiConfig({ statusLine: v === "on" });
          if (v === "on") ctx.ui.setFooter(statusLineFactory(ctx));
          else ctx.ui.setFooter(undefined);
          ctx.ui.notify(`tool-ui: statusline ${v}`, "info");
          return;
        }
        ctx.ui.notify(
          `tool-ui: statusline = ${loadToolUiConfig(ctx.cwd).statusLine === false ? "off" : "on"}  (/tool-ui statusline on|off)`,
          "info",
        );
        return;
      }
      ctx.ui.notify(
        `tool-ui: ${loadToolUiConfig(ctx.cwd).enabled ? "on" : "off"}  (/tool-ui on|off|list|colors|palette <名>|editor <on|off>|statusline <on|off>, 需 /reload)`,
        "info",
      );
    },
  });
}
