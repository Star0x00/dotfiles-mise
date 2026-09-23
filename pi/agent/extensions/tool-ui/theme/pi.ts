/**
 * tool-ui/theme/pi.ts — 把 base16 配色映射成完整 pi 主题
 *
 * 用 Theme 类构造全量 token，setTheme 后整个界面 (消息/编辑器/markdown/语法高亮)
 * 都跟随同一套配色，而不只是工具渲染。
 */

import { Theme, type ThemeBg, type ThemeColor } from "@earendil-works/pi-coding-agent";
import type { Base16Scheme } from "./base16.ts";

type ColorRecord = Record<string, string>;

/**
 * base16 → pi 主题 token。
 * 键是主题 token，值是 base16 槽位。改这里调整整体观感。
 */
const TOKEN_MAP = {
  // core
  accent: "base0D",
  border: "base02",
  borderAccent: "base0D",
  borderMuted: "base01",
  success: "base0B",
  error: "base08",
  warning: "base09",
  muted: "base04",
  dim: "base03",
  text: "base05",
  thinkingText: "base03",
  // messages
  userMessageText: "base05",
  customMessageText: "base05",
  customMessageLabel: "base0D",
  // tools
  toolTitle: "base0D",
  toolOutput: "base05",
  toolDiffAdded: "base0B",
  toolDiffRemoved: "base08",
  toolDiffContext: "base03",
  // markdown
  mdHeading: "base0D",
  mdLink: "base0D",
  mdLinkUrl: "base03",
  mdCode: "base0C",
  mdCodeBlock: "base05",
  mdCodeBlockBorder: "base03",
  mdQuote: "base04",
  mdQuoteBorder: "base03",
  mdHr: "base03",
  mdListBullet: "base0C",
  // syntax
  syntaxComment: "base03",
  syntaxKeyword: "base0E",
  syntaxFunction: "base0D",
  syntaxVariable: "base08",
  syntaxString: "base0B",
  syntaxNumber: "base09",
  syntaxType: "base0A",
  syntaxOperator: "base0C",
  syntaxPunctuation: "base04",
  // thinking levels
  thinkingOff: "base03",
  thinkingMinimal: "base0D",
  thinkingLow: "base0C",
  thinkingMedium: "base0B",
  thinkingHigh: "base09",
  thinkingXhigh: "base08",
  thinkingMax: "base0E",
  // misc
  bashMode: "base09",
  searchMatchText: "base00",
  scrollbarTrack: "base01",
  scrollbarThumb: "base03",
} as const satisfies Record<string, keyof Base16Scheme>;

const BG_MAP = {
  selectedBg: "base02",
  searchMatchBg: "base0A",
  userMessageBg: "base01",
  customMessageBg: "base01",
  toolPendingBg: "base01",
  toolSuccessBg: "base01",
  toolErrorBg: "base01",
} as const satisfies Record<string, keyof Base16Scheme>;

/** 用 base16 配色构造完整 pi 主题的 colors 表 (可直接写成主题 JSON)。 */
export function buildPiThemeColors(
  scheme: Base16Scheme,
  options: { userMessagePrompt?: boolean } = {},
): Record<string, string> {
  const pick = (slot: keyof Base16Scheme, fallback: string): string => scheme[slot] ?? fallback;
  const colors: ColorRecord = {};
  for (const [token, slot] of Object.entries(TOKEN_MAP)) {
    colors[token] = pick(slot as keyof Base16Scheme, "#e5e5e7");
  }
  for (const [token, slot] of Object.entries(BG_MAP)) {
    colors[token] = pick(slot as keyof Base16Scheme, "#1e1e1e");
  }
  // 用户消息不要底色块，配合 "❯ 输入" 前缀
  if (options.userMessagePrompt !== false) colors.userMessageBg = "";
  return colors;
}

/** 用 base16 配色构造一个完整的 pi Theme。 */
export function buildPiTheme(
  scheme: Base16Scheme,
  options: { name?: string; userMessagePrompt?: boolean } = {},
): Theme {
  const colors = buildPiThemeColors(scheme, options) as Record<ThemeColor & ThemeBg, string>;
  const { selectedBg, searchMatchBg, userMessageBg, customMessageBg, toolPendingBg, toolSuccessBg, toolErrorBg, ...fg } =
    colors as any;
  const bg = { selectedBg, searchMatchBg, userMessageBg, customMessageBg, toolPendingBg, toolSuccessBg, toolErrorBg };

  return new Theme(fg as Record<ThemeColor, string>, bg as Record<ThemeBg, string>, "truecolor", {
    name: options.name,
  });
}
