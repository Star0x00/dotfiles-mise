/**
 * tool-ui/theme/persist.ts — 把生成的 palette 主题落盘
 *
 * 目的: pi 在 /reload 或某些时机会把主题切回 settings.json 里配置的那个。
 * 只靠运行时 setTheme(Theme) 会被覆盖，所以这里把主题写成
 *   ~/.pi/agent/themes/tool-ui-<palette>.json
 * 并把 settings.json 的 theme 指过去，这样 pi 自己重载时也会用我们的主题。
 *
 * 只在值发生变化时才写，避免 pi 监听 settings 时触发循环重载。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const THEMES_DIR = join(homedir(), ".pi", "agent", "themes");
export const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

const SCHEMA_URL =
  "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json";

export function themeJsonPath(name: string): string {
  return join(THEMES_DIR, `${name}.json`);
}

function readJson(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

/** 写入主题 JSON，返回路径。内容没变时不写。 */
export function writePiThemeFile(name: string, colors: Record<string, string>): string {
  const path = themeJsonPath(name);
  const doc = { $schema: SCHEMA_URL, name, colors };
  const next = JSON.stringify(doc, null, 2) + "\n";
  if (existsSync(path)) {
    try {
      if (readFileSync(path, "utf-8") === next) return path;
    } catch {
      /* ignore */
    }
  }
  mkdirSync(THEMES_DIR, { recursive: true });
  writeFileSync(path, next);
  return path;
}

/** 把 settings.json 的 theme 指向 name。没变返回 false。 */
export function setSettingsTheme(name: string): boolean {
  const settings = readJson(SETTINGS_PATH);
  if (settings.theme === name) return false;
  settings.theme = name;
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  return true;
}
