/** Chữ trên khung hình video: dùng đúng bộ phông hệ thống của trang (đủ dấu tiếng Việt). */
export const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const DISPLAY = "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export type Ctx = CanvasRenderingContext2D;

export function font(size: number, weight: 400 | 600 | 700 = 400, family = SANS): string {
  return `${weight} ${size}px ${family}`;
}

/** Ngắt chữ theo bề ngang đo thật (ctx.font phải đặt trước). Từ dài hơn cả dòng đứng riêng một dòng. */
export function wrapToWidth(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const joined = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(joined).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = joined;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Thu gọn chữ một dòng cho vừa bề ngang, thêm "…" ở cuối. */
export function fitOneLine(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  // Cắt theo ký tự hiển thị: không tách cặp surrogate của emoji hay dấu tiếng Việt rời.
  const chars = Array.from(text.normalize('NFC'));
  while (chars.length > 1 && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/** Vẽ các dòng từ `y` (đỉnh dòng đầu), trả lại y ngay dưới dòng cuối. */
export function drawLines(ctx: Ctx, lines: readonly string[], x: number, y: number, lineHeight: number): number {
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

/** Hiện dần trong khoảng [from, to] của tiến độ cảnh (0–1). */
export function ease(progress: number, from = 0, to = 1): number {
  if (to <= from) return progress >= to ? 1 : 0;
  const x = Math.min(1, Math.max(0, (progress - from) / (to - from)));
  return 1 - (1 - x) ** 3;
}
