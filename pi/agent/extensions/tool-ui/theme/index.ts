/**
 * tool-ui/theme — 配色唯一入口
 *
 * 渲染层只认「通用角色名」(ColorRole)，不直接写 pi 主题 token。
 * 颜色值可以是:
 *   - pi 主题 token (如 "accent"、"toolTitle")  → 跟随当前 pi 主题
 *   - 十六进制 (如 "#c4a7e7")                    → 直接输出 24-bit ANSI
 *
 * 选择配色 (~/.pi/agent/tool-ui.json):
 * {
 *   "palette": "rose-pine-moon",   // "pi" | 内置 base16 名 | 内联 base16 对象
 *   "colors": { "tool": "accent" } // 按角色微调 (token 或 #hex)
 * }
 *
 * 目录:
 *   theme/index.ts          — 类型 / 解析 / 生成主题 / 列表
 *   theme/base16.ts         — base16 槽位 + 角色映射
 *   theme/schemes.ts        — 内置配色注册表
 *   theme/rose-pine-*.ts    — 具体配色数据
 */

import { BASE16_ROLE_MAP, base16ToRoles, type Base16Scheme } from "./base16.ts";
import { BASE16_PALETTES, listBase16Schemes } from "./schemes.ts";

// ---------------------------------------------------------------- roles

export type ColorRole =
  | "tool"
  | "arg"
  | "meta"
  | "metaStrong"
  | "success"
  | "error"
  | "warning"
  | "output"
  | "added"
  | "removed"
  | "gutter";

export type PaletteOverrides = Partial<Record<ColorRole, string>>;

/** 默认: 跟随 pi 当前主题 token。 */
export const DEFAULT_PALETTE: Record<ColorRole, string> = {
  tool: "toolTitle",
  arg: "accent",
  meta: "dim",
  metaStrong: "muted",
  success: "success",
  error: "error",
  warning: "warning",
  output: "toolOutput",
  added: "toolDiffAdded",
  removed: "toolDiffRemoved",
  gutter: "borderMuted",
};

export interface PaletteConfig {
  /** "pi" | 内置 base16 名 | 内联 base16 对象 */
  palette?: string | Base16Scheme;
  /** 按角色微调 */
  colors?: PaletteOverrides;
}

export function listPalettes(): string[] {
  return ["pi", ...listBase16Schemes()];
}

/** 按名字取内置 base16 配色。 */
export function getBase16Scheme(name: string): Base16Scheme | undefined {
  return BASE16_PALETTES[name];
}

/** palette 配置 (名字或内联对象) 解析成 base16 配色。 */
export function paletteScheme(palette?: string | Base16Scheme): Base16Scheme | undefined {
  if (!palette) return undefined;
  if (typeof palette === "string") return BASE16_PALETTES[palette];
  return palette;
}

export { buildPiTheme, buildPiThemeColors } from "./pi.ts";
export { setSettingsTheme, themeJsonPath, writePiThemeFile } from "./persist.ts";

// ---------------------------------------------------------------- resolve

export function resolvePalette(pc?: PaletteConfig): Record<ColorRole, string> {
  let base: Record<ColorRole, string> = { ...DEFAULT_PALETTE };
  const p = pc?.palette;
  if (typeof p === "string" && p && p !== "pi") {
    const scheme = BASE16_PALETTES[p];
    if (scheme) base = { ...base, ...base16ToRoles(scheme) };
  } else if (p && typeof p === "object") {
    base = { ...base, ...base16ToRoles(p) };
  }
  if (pc?.colors) base = { ...base, ...pc.colors };
  return base;
}

// ---------------------------------------------------------------- theme

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

function hexToAnsi(hex: string): string | undefined {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m`;
}

const FG_RESET = "\x1b[39m";

export interface ToolTheme {
  readonly palette: Record<ColorRole, string>;
  role(role: ColorRole, text: string): string;
  tool(text: string): string;
  arg(text: string): string;
  meta(text: string): string;
  metaStrong(text: string): string;
  success(text: string): string;
  error(text: string): string;
  warning(text: string): string;
  output(text: string): string;
  added(text: string): string;
  removed(text: string): string;
  gutter(text: string): string;
  /** 终端默认文字色 */
  text(text: string): string;
  bold(text: string): string;
}

export function makeTheme(theme: any, pc?: PaletteConfig): ToolTheme {
  const palette = resolvePalette(pc);

  const fg = (role: ColorRole, s: string): string => {
    const spec = palette[role];
    if (!spec || !s) return s;
    const ansi = hexToAnsi(spec);
    if (ansi) return `${ansi}${s}${FG_RESET}`;
    try {
      return theme.fg(spec, s);
    } catch {
      return s;
    }
  };
  const bold = (s: string): string => (typeof theme?.bold === "function" ? theme.bold(s) : s);

  return {
    palette,
    role: fg,
    tool: (s) => fg("tool", bold(s)),
    arg: (s) => fg("arg", s),
    meta: (s) => fg("meta", s),
    metaStrong: (s) => fg("metaStrong", s),
    success: (s) => fg("success", s),
    error: (s) => fg("error", s),
    warning: (s) => fg("warning", s),
    output: (s) => fg("output", s),
    added: (s) => fg("added", s),
    removed: (s) => fg("removed", s),
    gutter: (s) => fg("gutter", s),
    text: (s) => {
      try {
        return theme.fg("text", s);
      } catch {
        return s;
      }
    },
    bold,
  };
}

// ---------------------------------------------------------------- describe

/** 用真实主题渲染一行色块预览，用于 /tool-ui list。 */
export function previewPalette(name: string, theme: any): string {
  const t = makeTheme(theme, { palette: name === "pi" ? undefined : name });
  return [t.tool("tool"), t.arg("arg"), t.meta("meta"), t.success("ok"), t.error("err"), t.warning("warn")].join(
    " ",
  );
}

export function describePalette(pc?: PaletteConfig): string {
  const p = pc?.palette;
  const name = typeof p === "string" && p ? p : typeof p === "object" && p ? "inline base16" : "pi (跟随主题)";
  const resolved = resolvePalette(pc);
  const lines = (Object.keys(BASE16_ROLE_MAP) as ColorRole[]).map(
    (role) => `${role.padEnd(11)} ${resolved[role]}`,
  );
  return `palette: ${name}\n内置: ${listPalettes().join(", ")}\n\n${lines.join("\n")}`;
}
