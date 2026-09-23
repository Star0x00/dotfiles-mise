/**
 * tool-ui/theme/base16.ts — base16 槽位定义与「角色 → 槽位」映射
 *
 * 新增配色时不需要改这里：加一个 schemes 文件，在 schemes.ts 注册即可。
 */

import type { ColorRole } from "./index.ts";

export const BASE16_KEYS = [
  "base00",
  "base01",
  "base02",
  "base03",
  "base04",
  "base05",
  "base06",
  "base07",
  "base08",
  "base09",
  "base0A",
  "base0B",
  "base0C",
  "base0D",
  "base0E",
  "base0F",
] as const;

export type Base16Key = (typeof BASE16_KEYS)[number];
export type Base16Scheme = Partial<Record<Base16Key, string>>;

/** 通用角色 → base16 槽位。改这里会影响所有 base16 配色。 */
export const BASE16_ROLE_MAP: Record<ColorRole, Base16Key> = {
  tool: "base0D",
  arg: "base0C",
  meta: "base03",
  metaStrong: "base04",
  success: "base0B",
  error: "base08",
  warning: "base09",
  output: "base05",
  added: "base0B",
  removed: "base08",
  gutter: "base03",
};

export function base16ToRoles(scheme: Base16Scheme): Partial<Record<ColorRole, string>> {
  const out: Partial<Record<ColorRole, string>> = {};
  for (const role of Object.keys(BASE16_ROLE_MAP) as ColorRole[]) {
    const v = scheme[BASE16_ROLE_MAP[role]];
    if (v) out[role] = v;
  }
  return out;
}
