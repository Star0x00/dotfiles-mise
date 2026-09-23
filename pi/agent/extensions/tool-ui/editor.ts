/**
 * tool-ui/editor.ts — "❯ 输入" 风格输入框
 *
 * 保留 pi 默认编辑器的上下边框，只在内容行前面加箭头提示符:
 *
 *   ────────────────────────────
 *   ❯ 你的输入
 *   ────────────────────────────
 *
 * 多行输入时后续行缩进两个空格；提示符颜色用 theme.borderColor
 * (会跟随 thinking 级别 / bash 模式变色)。
 *
 * 注意: 内容行原本就占满 width，必须先按 width-2 收窄再拼提示符，
 * 否则截断会在行尾留下 "…"/"..." 三个点。
 */

import { CustomEditor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export class PromptEditor extends CustomEditor {
  render(width: number): string[] {
    const lines = super.render(width);
    const visible = (this as any).renderedVisibleLineCount as number | undefined;
    // super.render 结构: [上边框, ...内容行, 下边框, ...autocomplete]
    if (typeof visible !== "number" || visible < 0 || lines.length < visible + 2) return lines;

    const paddingX = this.getPaddingX();
    const color = this.borderColor ?? ((s: string) => s);
    const stripLeft = (s: string): string => (paddingX > 0 ? s.slice(paddingX) : s);
    const stripTrailingSpaces = (s: string): string => s.replace(/ +$/, "");

    const prefixWidth = 2; // "❯ " / 两个续行缩进空格
    const avail = Math.max(1, width - prefixWidth);

    const out: string[] = [lines[0]];
    for (let i = 0; i < visible; i++) {
      const body = stripTrailingSpaces(stripLeft(lines[1 + i]));
      const fitted = visibleWidth(body) > avail ? truncateToWidth(body, avail, "…") : body;
      const pad = " ".repeat(Math.max(0, avail - visibleWidth(fitted)));
      const prefix = i === 0 ? `${color("❯")} ` : "  ";
      out.push(prefix + fitted + pad);
    }
    out.push(lines[1 + visible]);
    for (const line of lines.slice(2 + visible)) out.push(line);
    return out;
  }
}
