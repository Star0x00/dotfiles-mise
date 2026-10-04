/**
 * tool-ui/theme/schemes.ts — 内置 base16 配色注册表
 *
 * 新增配色：
 * 1. 在本目录加一个文件，导出 Base16Scheme
 * 2. 在下面 import 并注册一个名字
 */

import type { Base16Scheme } from "./base16.ts";
import { catppuccinMocha } from "./catppuccin-mocha.ts";
import { gruvboxMaterial } from "./gruvbox-material.ts";
import { rosePineDawn } from "./rose-pine-dawn.ts";
import { rosePineMoon } from "./rose-pine-moon.ts";
import { tokyonight } from "./tokyonight.ts";

export const BASE16_PALETTES: Record<string, Base16Scheme> = {
  "catppuccin-mocha": catppuccinMocha,
  "gruvbox-material": gruvboxMaterial,
  "rose-pine-moon": rosePineMoon,
  "rose-pine-dawn": rosePineDawn,
  "tokyonight": tokyonight,
};

export function listBase16Schemes(): string[] {
  return Object.keys(BASE16_PALETTES);
}
