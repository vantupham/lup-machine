import { MOBILENET_SUMMARY } from '@/core/ml/network-summary';
import { FUNNEL_HEIGHT, funnelLayout, INPUT_BOX } from '@/features/studio/image/lab/network-funnel';
import { ease, fitOneLine, font } from './canvas-text';
import { classColor, VIDEO_COLORS as C } from './palette';
import { formatNumber, formatPercent, type Painter } from './paint-env';

const K = 'lecture.canvas';
const FUNNEL = funnelLayout(MOBILENET_SUMMARY.blocks);

/** Phễu MobileNetV2 lấy đúng toạ độ của sơ đồ ở bước 4, thu phóng cho vừa khung. */
export const paintNetwork: Painter<'network'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const labelH = fonts.small * 3;
  const scale = Math.min(rect.w / FUNNEL.width, (rect.h - labelH) / FUNNEL_HEIGHT);
  const ox = rect.x + (rect.w - FUNNEL.width * scale) / 2;
  const oy = rect.y;
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + y * scale;

  ctx.fillStyle = C.surface;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  const inputY = FUNNEL.centerY - INPUT_BOX.size / 2;
  ctx.strokeRect(X(INPUT_BOX.x), Y(inputY), INPUT_BOX.size * scale, INPUT_BOX.size * scale);

  const slabs = FUNNEL.stages.flatMap((s) => s.slabs);
  const input = env.thumbs.get(0)?.[0];
  if (input) ctx.drawImage(input, X(INPUT_BOX.x), Y(inputY), INPUT_BOX.size * scale, INPUT_BOX.size * scale);

  const polygon = (points: readonly (readonly [number, number])[], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fill();
  };
  slabs.forEach((slab, i) => {
    if (ease(progress, 0.02 + (i / slabs.length) * 0.25, 0.03 + (i / slabs.length) * 0.25) <= 0) return;
    const { x, y, w, h, depth: d } = slab;
    // Mặt trên và mặt bên là hình bình hành nối liền mặt trước (khối hộp phối cảnh).
    polygon([[x, y], [x + d, y - d], [x + w + d, y - d], [x + w, y]], C.rule);
    polygon([[x + w, y], [x + w + d, y - d], [x + w + d, y + h - d], [x + w, y + h]], '#8b93a1');
    ctx.fillStyle = C.muted;
    ctx.fillRect(X(x), Y(y), w * scale, h * scale);
  });

  const classYs = FUNNEL.classY(visual.classNames.length);
  const learn = ease(progress, 0.3, 0.5);
  ctx.strokeStyle = C.primary;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = learn;
  for (const cy of classYs) {
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(X(FUNNEL.pool.x), Y(FUNNEL.centerY + k * 12));
      ctx.lineTo(X(FUNNEL.output.x), Y(cy));
      ctx.stroke();
    }
  }
  ctx.font = font(fonts.small, 600);
  ctx.textBaseline = 'middle';
  classYs.forEach((cy, i) => {
    ctx.fillStyle = classColor(i);
    ctx.beginPath();
    ctx.arc(X(FUNNEL.output.x), Y(cy), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(fitOneLine(ctx, visual.classNames[i] ?? '', rect.x + rect.w - X(FUNNEL.output.x) - 16), X(FUNNEL.output.x) + 14, Y(cy));
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.ink;
  ctx.font = font(fonts.small);
  ctx.textBaseline = 'top';
  const labelY = Y(FUNNEL_HEIGHT) + fonts.small * 0.4;
  ctx.textAlign = 'center';
  ctx.fillText(env.t(`${K}.frozen`, { layers: formatNumber(env, visual.totalLayers) }), X((FUNNEL.frozen.x0 + FUNNEL.frozen.x1) / 2), labelY);
  ctx.fillStyle = C.primary;
  ctx.globalAlpha = learn;
  ctx.fillText(env.t(`${K}.learns`, { params: formatNumber(env, visual.denseParams) }), X((FUNNEL.pool.x + FUNNEL.output.x) / 2), labelY + fonts.small * 1.4);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
};

/** Khung trục cho biểu đồ: trả về hàm đổi (tỉ lệ x 0–1, giá trị y 0–1) sang toạ độ điểm ảnh. */
function plotArea(rect: { x: number; y: number; w: number; h: number }, pad: number) {
  const area = { x: rect.x + pad * 3, y: rect.y + pad, w: rect.w - pad * 4, h: rect.h - pad * 3.2 };
  return { area, px: (fx: number) => area.x + fx * area.w, py: (fy: number) => area.y + (1 - fy) * area.h };
}

export const paintTraining: Painter<'training'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const { area, px, py } = plotArea(rect, fonts.small * 1.2);
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1;
  ctx.fillStyle = C.muted;
  ctx.font = font(fonts.small);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const v of [0, 0.5, 1]) {
    ctx.beginPath();
    ctx.moveTo(area.x, py(v));
    ctx.lineTo(area.x + area.w, py(v));
    ctx.stroke();
    ctx.fillText(formatPercent(env, v, 0), area.x - 8, py(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(env.t(`${K}.epochs`, { count: visual.epochs }), area.x + area.w / 2, area.y + area.h + fonts.small * 0.5);
  ctx.textAlign = 'left';

  const metrics = visual.metrics;
  const shown = Math.max(1, Math.round(metrics.length * ease(progress, 0.03, 0.5)));
  const series = [
    { key: 'train', color: C.primary, value: (i: number) => metrics[i]?.trainAccuracy ?? null },
    { key: 'test', color: C.warning, value: (i: number) => metrics[i]?.testAccuracy ?? null },
  ] as const;
  const denom = Math.max(1, metrics.length - 1);
  series.forEach((s, si) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < shown; i++) {
      const v = s.value(i);
      if (v === null) continue;
      if (started) ctx.lineTo(px(i / denom), py(v));
      else ctx.moveTo(px(i / denom), py(v));
      started = true;
    }
    ctx.stroke();
    const last = s.value(shown - 1);
    if (last === null) return;
    ctx.fillStyle = s.color;
    ctx.font = font(fonts.small, 700);
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${env.t(`${K}.${s.key}`)} ${formatPercent(env, last)}`, area.x + 12, area.y + fonts.small * 1.4 * (si + 1));
  });
};

export const paintEvaluation: Painter<'evaluation'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const n = Math.max(1, visual.classNames.length);
  ctx.font = font(fonts.small, 600);
  const labelW = Math.min(rect.w * 0.3, Math.max(0, ...visual.classNames.map((c) => ctx.measureText(c).width)) + 12);
  const headerH = fonts.small * 2.6;
  const cell = Math.min((rect.w - labelW) / n, (rect.h - headerH) / n);
  const gx = rect.x + labelW + (rect.w - labelW - cell * n) / 2;
  const gy = rect.y + headerH;
  const maxCount = Math.max(1, ...visual.matrix.flat());

  ctx.fillStyle = C.muted;
  ctx.font = font(fonts.small);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(env.t(`${K}.predicted`), gx + (cell * n) / 2, rect.y);
  visual.classNames.forEach((name, j) => {
    ctx.fillStyle = classColor(j);
    ctx.font = font(fonts.small, 600);
    ctx.fillText(fitOneLine(ctx, name, cell - 6), gx + j * cell + cell / 2, rect.y + fonts.small * 1.3);
  });
  visual.matrix.forEach((row, i) => {
    ctx.globalAlpha = 1;
    ctx.font = font(fonts.small, 600);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = classColor(i);
    ctx.fillText(fitOneLine(ctx, visual.classNames[i] ?? '', labelW - 12), gx - 10, gy + i * cell + cell / 2);
    row.forEach((count, j) => {
      const reveal = ease(progress, 0.02 + ((i * n + j) / (n * n)) * 0.2, 0.06 + ((i * n + j) / (n * n)) * 0.2);
      const x = gx + j * cell;
      const y = gy + i * cell;
      ctx.globalAlpha = reveal * (count === 0 ? 0.08 : 0.15 + (0.75 * count) / maxCount);
      ctx.fillStyle = i === j ? C.accent : C.danger;
      ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      ctx.globalAlpha = reveal;
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.font = font(Math.round(Math.min(cell * 0.38, fonts.title)), 700);
      ctx.fillText(formatNumber(env, count), x + cell / 2, y + cell / 2);
      ctx.font = font(fonts.small, 600);
    });
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
};

export const paintExperiments: Painter<'experiments'> = (ctx, visual, rect, progress, env) => {
  const { fonts } = env.layout;
  const { area, py } = plotArea(rect, fonts.small * 1.2);
  const runs = visual.runs;
  const slot = area.w / Math.max(1, runs.length);
  const best = Math.max(...runs.map((r) => r.testAccuracy ?? -1));
  ctx.font = font(fonts.small, 600);
  ctx.textAlign = 'center';
  runs.forEach((run, i) => {
    const grow = ease(progress, 0.03 + i * 0.05, 0.2 + i * 0.05);
    const x = area.x + i * slot + slot * 0.2;
    const w = slot * 0.6;
    const value = run.testAccuracy ?? 0;
    const top = py(value * grow);
    ctx.fillStyle = run.testAccuracy === best ? C.accent : C.muted;
    ctx.fillRect(x, top, w, py(0) - top);
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'bottom';
    if (run.testAccuracy !== null) ctx.fillText(formatPercent(env, run.testAccuracy), x + w / 2, top - 6);
    ctx.textBaseline = 'top';
    ctx.fillText(env.t(`${K}.run`, { n: run.number }), x + w / 2, py(0) + 8);
  });
  ctx.textAlign = 'left';
};
