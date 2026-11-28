import { DISPLAY, drawLines, ease, fitOneLine, font, wrapToWidth } from './canvas-text';
import { classColor, VIDEO_COLORS as C } from './palette';
import { formatNumber, formatPercent, type Painter } from './paint-env';
import type { FrameLayout, Rect } from './frame-layout';

const K = 'lecture.canvas';

/** Hàng chấm màu + tên lớp, căn giữa quanh `cx`; xuống dòng khi quá rộng. */
function drawClassChips(ctx: CanvasRenderingContext2D, names: readonly string[], cx: number, y: number, maxWidth: number, size: number): number {
  ctx.font = font(size, 600);
  const gap = size * 1.2;
  const dot = size * 0.45;
  const items = names.map((name, i) => ({ name: fitOneLine(ctx, name, maxWidth * 0.6), color: classColor(i) }));
  const rows: (typeof items)[] = [[]];
  let rowWidth = 0;
  for (const item of items) {
    const w = dot * 2 + size * 0.4 + ctx.measureText(item.name).width;
    if (rowWidth > 0 && rowWidth + gap + w > maxWidth) {
      rows.push([]);
      rowWidth = 0;
    }
    rows.at(-1)!.push(item);
    rowWidth += (rowWidth > 0 ? gap : 0) + w;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  rows.forEach((row, r) => {
    const widths = row.map((item) => dot * 2 + size * 0.4 + ctx.measureText(item.name).width);
    let x = cx - (widths.reduce((s, w) => s + w, 0) + gap * (row.length - 1)) / 2;
    const rowY = y + r * size * 1.8;
    row.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + dot, rowY, dot, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.fillText(item.name, x + dot * 2 + size * 0.4, rowY);
      x += (widths[i] ?? 0) + gap;
    });
  });
  return y + rows.length * size * 1.8;
}

export const paintTitle: Painter<'title'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  ctx.globalAlpha = ease(progress, 0, 0.15);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink;
  ctx.font = font(Math.round(fonts.hero * 0.55), 700, DISPLAY);
  const lines = wrapToWidth(ctx, visual.projectName, rect.w * 0.9);
  const lineH = fonts.hero * 0.7;
  const top = rect.y + rect.h * 0.3 - (lines.length * lineH) / 2;
  const below = drawLines(ctx, lines, rect.x + rect.w / 2, top, lineH);
  ctx.globalAlpha = ease(progress, 0.05, 0.25);
  drawClassChips(ctx, visual.classNames, rect.x + rect.w / 2, below + fonts.body * 1.5, rect.w * 0.9, fonts.body);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.font = font(fonts.small);
  ctx.textBaseline = 'bottom';
  ctx.fillText(env.t(`${K}.brand`), rect.x + rect.w / 2, rect.y + rect.h);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
};

interface DataRow {
  readonly thumbs: { readonly x: number; readonly y: number; readonly size: number };
  readonly name: { readonly x: number; readonly y: number; readonly w: number };
  readonly bar: { readonly x: number; readonly y: number; readonly h: number; readonly max: number };
}

/** Khổ ngang: ảnh | tên | thanh trên một hàng. Khổ dọc: ảnh ở trên, tên rồi thanh ở dưới. */
function dataRows(ctx: CanvasRenderingContext2D, names: readonly string[], rect: Rect, fonts: FrameLayout['fonts'], hasThumbs: boolean): DataRow[] {
  const legendH = fonts.small * 2.4;
  const rowH = Math.min((rect.h - legendH) / Math.max(1, names.length), fonts.body * (rect.w > rect.h ? 4.5 : 9));
  const valueW = fonts.body * 4;
  if (rect.w > rect.h) {
    const size = hasThumbs ? rowH * 0.8 : 0;
    const thumbsW = hasThumbs ? size * 3 + 12 + 12 : 0;
    ctx.font = font(fonts.body, 600);
    const nameW = Math.min(rect.w * 0.28, Math.max(0, ...names.map((n) => ctx.measureText(n).width)) + 16);
    const barX = rect.x + thumbsW + nameW;
    return names.map((_, i) => {
      const y = rect.y + i * rowH;
      return {
        thumbs: { x: rect.x, y: y + (rowH - size) / 2, size },
        name: { x: rect.x + thumbsW, y: y + rowH / 2, w: nameW - 8 },
        bar: { x: barX, y: y + rowH * 0.29, h: rowH * 0.42, max: rect.x + rect.w - barX - valueW },
      };
    });
  }
  const size = hasThumbs ? Math.min(rowH * 0.5, (rect.w - 12) / 3) : 0;
  return names.map((_, i) => {
    const y = rect.y + i * rowH;
    const nameY = y + size + fonts.body * 0.9;
    return {
      thumbs: { x: rect.x, y, size },
      name: { x: rect.x, y: nameY, w: rect.w },
      bar: { x: rect.x, y: nameY + fonts.body * 0.8, h: fonts.body * 1.1, max: rect.w - valueW },
    };
  });
}

export const paintData: Painter<'data'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const rows = dataRows(ctx, visual.classes.map((c) => c.name), rect, fonts, env.thumbs.size > 0);
  const maxTotal = Math.max(1, ...visual.classes.map((c) => c.train + c.test));
  visual.classes.forEach((c, i) => {
    const row = rows[i]!;
    const grow = ease(progress, 0.03 + i * 0.05, 0.2 + i * 0.05);
    (env.thumbs.get(i) ?? []).slice(0, 3).forEach((img, k) => ctx.drawImage(img, row.thumbs.x + k * (row.thumbs.size + 6), row.thumbs.y, row.thumbs.size, row.thumbs.size));
    ctx.fillStyle = classColor(i);
    ctx.font = font(fonts.body, 600);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(fitOneLine(ctx, c.name, row.name.w), row.name.x, row.name.y);
    const trainW = (row.bar.max * c.train * grow) / maxTotal;
    const testW = (row.bar.max * c.test * grow) / maxTotal;
    ctx.fillRect(row.bar.x, row.bar.y, trainW, row.bar.h);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(row.bar.x + trainW, row.bar.y, testW, row.bar.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.ink;
    ctx.font = font(fonts.small, 600);
    ctx.fillText(`${formatNumber(env, c.train)} + ${formatNumber(env, c.test)}`, row.bar.x + trainW + testW + 10, row.bar.y + row.bar.h / 2);
  });

  ctx.font = font(fonts.small);
  ctx.textBaseline = 'middle';
  const lx = rows[0]?.bar.x ?? rect.x;
  const ly = rect.y + rect.h - fonts.small;
  ctx.fillStyle = C.ink;
  ctx.fillRect(lx, ly - fonts.small / 3, fonts.small, fonts.small * 0.66);
  ctx.fillText(env.t(`${K}.train`), lx + fonts.small * 1.4, ly);
  const testX = lx + fonts.small * 2 + ctx.measureText(env.t(`${K}.train`)).width + fonts.small * 1.5;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(testX, ly - fonts.small / 3, fonts.small, fonts.small * 0.66);
  ctx.globalAlpha = 1;
  ctx.fillText(env.t(`${K}.test`), testX + fonts.small * 1.4, ly);
};

/** Thẻ số lớn: một con số và dòng giải thích (màu cảnh báo khi > 0). */
function drawStatCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: string, label: string, isWarning: boolean, fonts: { hero: number; small: number }): void {
  ctx.fillStyle = C.surface;
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = isWarning ? C.danger : C.accent;
  ctx.font = font(Math.round(fonts.hero * 0.6), 700);
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x + w / 2, y + h * 0.38);
  ctx.fillStyle = C.ink;
  ctx.font = font(fonts.small);
  drawLines(ctx, wrapToWidth(ctx, label, w * 0.86), x + w / 2, y + h * 0.62, fonts.small * 1.3);
  ctx.textAlign = 'left';
}

export const paintDataCheck: Painter<'data-check'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const cards = [
    { value: formatNumber(env, visual.leakPairs), label: env.t(`${K}.leakPairs`), isWarning: visual.leakPairs > 0 },
    { value: formatNumber(env, visual.sameSplitPairs), label: env.t(`${K}.samePairs`), isWarning: visual.sameSplitPairs > 0 },
    visual.shortcutAccuracy === null
      ? { value: env.t(`${K}.none`), label: env.t(`${K}.shortcut`), isWarning: false }
      : { value: formatPercent(env, visual.shortcutAccuracy, 0), label: env.t(`${K}.shortcut`), isWarning: true },
  ];
  const isRow = rect.w > rect.h;
  const gap = fonts.body;
  const w = isRow ? (rect.w - gap * 2) / 3 : rect.w * 0.8;
  const h = isRow ? Math.min(rect.h * 0.75, w * 0.8) : (rect.h - gap * 2) / 3;
  cards.forEach((card, i) => {
    ctx.globalAlpha = ease(progress, i * 0.06, 0.12 + i * 0.06);
    const x = isRow ? rect.x + i * (w + gap) : rect.x + (rect.w - w) / 2;
    const y = isRow ? rect.y + (rect.h - h) / 2 : rect.y + i * (h + gap);
    drawStatCard(ctx, x, y, w, h, card.value, card.label, card.isWarning, fonts);
  });
  ctx.globalAlpha = 1;
};

export const paintLimits: Painter<'limits'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const box = Math.min(rect.w, rect.h) * 0.32;
  const cx = rect.x + rect.w / 2;
  ctx.globalAlpha = ease(progress, 0, 0.2);
  ctx.strokeStyle = C.warning;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(cx - box / 2, rect.y, box, box);
  ctx.setLineDash([]);
  ctx.fillStyle = C.warning;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(Math.round(box * 0.5), 700);
  ctx.fillText('?', cx, rect.y + box / 2);
  ctx.font = font(fonts.small);
  ctx.fillStyle = C.ink;
  ctx.fillText(env.t(`${K}.unknownImage`), cx, rect.y + box + fonts.small * 1.2);
  ctx.globalAlpha = ease(progress, 0.1, 0.3);
  drawClassChips(ctx, visual.classNames, cx, rect.y + box + fonts.small * 3.5, rect.w * 0.9, fonts.body);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
};

type SummaryVisual = Parameters<Painter<'summary'>>[1];
type Fonts = FrameLayout['fonts'];

/** Thẻ tổng kết: nền sáng, vạch màu ở đầu, tiêu đề nhỏ; trả về vùng nội dung bên dưới tiêu đề. */
function drawSummaryCard(ctx: CanvasRenderingContext2D, card: Rect, heading: string, accent: string, fonts: Fonts): Rect {
  ctx.fillStyle = C.surface;
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 2;
  ctx.fillRect(card.x, card.y, card.w, card.h);
  ctx.strokeRect(card.x, card.y, card.w, card.h);
  ctx.fillStyle = accent;
  ctx.fillRect(card.x, card.y, card.w, Math.max(4, fonts.small * 0.25));
  ctx.font = font(fonts.small, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const pad = fonts.small;
  ctx.fillText(fitOneLine(ctx, heading, card.w - pad * 2), card.x + pad, card.y + pad);
  const top = card.y + pad * 2.6;
  return { x: card.x + pad, y: top, w: card.w - pad * 2, h: card.y + card.h - pad - top };
}

/** Chữ nhiều dòng căn giữa trong vùng, cỡ chữ tự thu nhỏ cho vừa chiều cao. */
function drawCentered(ctx: CanvasRenderingContext2D, text: string, area: Rect, size: number, weight: 400 | 600 | 700, color: string, y?: number): number {
  let fontSize = size;
  let lines: string[] = [];
  for (; fontSize > 10; fontSize -= 2) {
    ctx.font = font(fontSize, weight);
    lines = wrapToWidth(ctx, text, area.w);
    if (lines.length * fontSize * 1.3 <= area.h) break;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const lineH = fontSize * 1.3;
  const top = y ?? area.y + (area.h - lines.length * lineH) / 2;
  return drawLines(ctx, lines, area.x + area.w / 2, top, lineH);
}

function paintScore(ctx: CanvasRenderingContext2D, visual: SummaryVisual, area: Rect, env: Parameters<Painter<'summary'>>[4]): void {
  const { fonts } = env.layout;
  if (!visual.score) {
    drawCentered(ctx, env.t(`${K}.noScore`), area, fonts.body, 600, C.muted);
    return;
  }
  const big = Math.round(Math.min(fonts.hero * 0.9, area.w * 0.28, area.h * 0.45));
  ctx.font = font(big, 700);
  ctx.fillStyle = visual.score.split === 'test' ? C.primary : C.warning;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const top = area.y + Math.max(0, (area.h - big * 1.2 - fonts.small * 3) / 2);
  ctx.fillText(formatPercent(env, visual.score.accuracy), area.x + area.w / 2, top);
  const label = env.t(visual.score.split === 'test' ? `${K}.summaryLabel` : `${K}.summaryTrainLabel`);
  drawCentered(ctx, label, { ...area, y: top + big * 1.2, h: fonts.small * 3 }, fonts.small, 400, C.ink, top + big * 1.25);
}

function paintImprove(ctx: CanvasRenderingContext2D, visual: SummaryVisual, area: Rect, env: Parameters<Painter<'summary'>>[4]): void {
  const { fonts } = env.layout;
  if (!visual.confusion) {
    drawCentered(ctx, env.t(`${K}.harder`), area, fonts.body, 400, C.ink);
    return;
  }
  // Lớp thật → "hay bị đoán là" → lớp máy đoán: ba dòng giữa thẻ.
  const name = Math.round(Math.min(fonts.title, area.h * 0.22));
  const rowH = name * 1.5;
  const top = area.y + Math.max(0, (area.h - rowH * 2 - fonts.small * 2) / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = font(name, 700);
  ctx.fillStyle = C.ink;
  ctx.fillText(fitOneLine(ctx, visual.confusion.actual, area.w), area.x + area.w / 2, top);
  ctx.font = font(fonts.small);
  ctx.fillStyle = C.danger;
  ctx.fillText(env.t(`${K}.confusedAs`), area.x + area.w / 2, top + rowH);
  ctx.font = font(name, 700);
  ctx.fillStyle = C.ink;
  ctx.fillText(fitOneLine(ctx, visual.confusion.predicted, area.w), area.x + area.w / 2, top + rowH + fonts.small * 2);
}

/** Tóm lại: ba thẻ (kết quả, cần cải thiện, câu hỏi) luôn có nội dung, kể cả khi chưa có ảnh Kiểm tra. */
export const paintSummary: Painter<'summary'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const isRow = rect.w > rect.h;
  const gap = fonts.body;
  const w = isRow ? (rect.w - gap * 2) / 3 : rect.w;
  const h = isRow ? rect.h : (rect.h - gap * 2) / 3;
  const cards = [
    { heading: `${K}.summaryResult`, accent: C.primary, paint: paintScore },
    { heading: `${K}.summaryImprove`, accent: C.danger, paint: paintImprove },
    { heading: `${K}.summaryQuestion`, accent: C.accent, paint: (c: CanvasRenderingContext2D, _v: SummaryVisual, area: Rect) => void drawCentered(c, env.t(`${K}.question`), area, fonts.body, 600, C.ink) },
  ];
  cards.forEach((card, i) => {
    ctx.globalAlpha = ease(progress, i * 0.08, 0.16 + i * 0.08);
    const box = { x: isRow ? rect.x + i * (w + gap) : rect.x, y: isRow ? rect.y : rect.y + i * (h + gap), w, h };
    const area = drawSummaryCard(ctx, box, env.t(card.heading), card.accent, fonts);
    card.paint(ctx, visual, area, env);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
};

/** Cảnh kết: dòng chữ mời trải nghiệm LUP Machine giữa khung, kèm địa chỉ trang. */
export const paintOutro: Painter<'outro'> = (ctx, _visual, rect, progress, env) => {
  const { fonts } = env.layout;
  ctx.globalAlpha = ease(progress, 0, 0.3);
  const area = { x: rect.x + rect.w * 0.08, y: rect.y, w: rect.w * 0.84, h: rect.h };
  ctx.font = font(Math.round(fonts.title * 1.4), 700, DISPLAY);
  const lines = wrapToWidth(ctx, env.t(`${K}.outro`), area.w);
  const lineH = fonts.title * 1.9;
  const blockH = lines.length * lineH + fonts.body * 3;
  const top = area.y + (area.h - blockH) / 2;
  ctx.fillStyle = C.primary;
  ctx.fillRect(area.x + area.w / 2 - fonts.title, top - fonts.body * 1.5, fonts.title * 2, Math.max(4, fonts.small * 0.3));
  ctx.textAlign = 'center';
  ctx.fillStyle = C.ink;
  const below = drawLines(ctx, lines, area.x + area.w / 2, top, lineH);
  // Link đầy đủ: thu nhỏ chữ cho vừa bề ngang khung dọc, không cắt mất ký tự nào.
  const url = env.t(`${K}.outroUrl`);
  let urlSize = fonts.body;
  ctx.font = font(urlSize, 600);
  while (urlSize > 12 && ctx.measureText(url).width > area.w) ctx.font = font(--urlSize, 600);
  ctx.fillStyle = C.primary;
  ctx.textBaseline = 'top';
  ctx.fillText(url, area.x + area.w / 2, below + fonts.body);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
};
