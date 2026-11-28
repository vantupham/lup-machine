import type { Cue } from '@/core/lecture/subtitles';
import type { LectureScene, LectureScript, SceneVisual } from '../lecture-script';
import type { LectureTimeline } from '../script-timeline';
import { drawLines, fitOneLine, font, wrapToWidth, type Ctx } from './canvas-text';
import { VIDEO_COLORS as C } from './palette';
import { paintData, paintDataCheck, paintLimits, paintOutro, paintSummary, paintTitle } from './paint-basic';
import { paintEvaluation, paintExperiments, paintNetwork, paintTraining } from './paint-charts';
import type { PaintEnv } from './paint-env';
import type { Rect } from './frame-layout';

export interface FrameInput {
  readonly script: LectureScript;
  readonly timeline: LectureTimeline;
  /** Giây tính từ đầu video. */
  readonly time: number;
  /** In phụ đề lên hình. */
  readonly burnSubtitles: boolean;
}

/** Cảnh đang chiếu ở thời điểm `time` và tiến độ 0–1 của nó (khoảng nghỉ giữa hai cảnh thuộc cảnh trước). */
export function sceneAt(timeline: LectureTimeline, time: number): { readonly index: number; readonly progress: number } {
  const scenes = timeline.scenes;
  if (scenes.length === 0) return { index: -1, progress: 0 };
  let index = scenes.findIndex((s, i) => time < (scenes[i + 1]?.start ?? Number.POSITIVE_INFINITY) && time >= s.start);
  if (index < 0) index = time < (scenes[0]?.start ?? 0) ? 0 : scenes.length - 1;
  const scene = scenes[index]!;
  const end = scenes[index + 1]?.start ?? scene.end;
  const span = Math.max(1e-6, end - scene.start);
  return { index, progress: Math.min(1, Math.max(0, (time - scene.start) / span)) };
}

export function cueAt(cues: readonly Cue[], time: number): Cue | null {
  return cues.find((c) => time >= c.start && time < c.end) ?? null;
}

function paintVisual(ctx: Ctx, visual: SceneVisual, rect: Rect, progress: number, env: PaintEnv): void {
  switch (visual.kind) {
    case 'title':
      return paintTitle(ctx, visual, rect, progress, env);
    case 'data':
      return paintData(ctx, visual, rect, progress, env);
    case 'data-check':
      return paintDataCheck(ctx, visual, rect, progress, env);
    case 'network':
      return paintNetwork(ctx, visual, rect, progress, env);
    case 'training':
      return paintTraining(ctx, visual, rect, progress, env);
    case 'evaluation':
      return paintEvaluation(ctx, visual, rect, progress, env);
    case 'experiments':
      return paintExperiments(ctx, visual, rect, progress, env);
    case 'limits':
      return paintLimits(ctx, visual, rect, progress, env);
    case 'summary':
      return paintSummary(ctx, visual, rect, progress, env);
    case 'outro':
      return paintOutro(ctx, visual, rect, progress, env);
  }
}

function paintHeader(ctx: Ctx, scene: LectureScene, index: number, total: number, env: PaintEnv): void {
  const { header, fonts } = env.layout;
  const dot = fonts.small * 0.3;
  const dotsW = total * dot * 3;
  ctx.fillStyle = C.ink;
  ctx.font = font(fonts.title, 700);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(fitOneLine(ctx, scene.title, header.w - dotsW - fonts.body), header.x, header.y + header.h / 2);
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i <= index ? C.primary : C.rule;
    ctx.beginPath();
    ctx.arc(header.x + header.w - dotsW + i * dot * 3 + dot, header.y + header.h / 2, dot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = C.rule;
  ctx.fillRect(header.x, header.y + header.h - 2, header.w, 2);
}

function paintSubtitle(ctx: Ctx, cue: Cue, env: PaintEnv): void {
  const { subtitle, fonts } = env.layout;
  ctx.font = font(fonts.subtitle, 600);
  const lines = cue.text.split('\n').flatMap((line) => wrapToWidth(ctx, line, subtitle.w - fonts.subtitle * 1.2));
  const lineH = fonts.subtitle * 1.25;
  const boxH = lines.length * lineH + fonts.subtitle * 0.6;
  const boxW = Math.min(subtitle.w, Math.max(0, ...lines.map((l) => ctx.measureText(l).width)) + fonts.subtitle * 1.2);
  const x = subtitle.x + (subtitle.w - boxW) / 2;
  const y = subtitle.y + subtitle.h - boxH;
  ctx.fillStyle = C.subtitleBg;
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, fonts.subtitle * 0.3);
  ctx.fill();
  ctx.fillStyle = C.subtitleInk;
  ctx.textAlign = 'center';
  drawLines(ctx, lines, subtitle.x + subtitle.w / 2, y + fonts.subtitle * 0.3, lineH);
  ctx.textAlign = 'left';
}

/** Vẽ một khung hình hoàn chỉnh: dùng chung cho xem trước và xuất video (xem sao, xuất vậy). */
export function renderFrame(ctx: Ctx, input: FrameInput, env: PaintEnv): void {
  const { size, visual } = env.layout;
  ctx.save();
  try {
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, size.width, size.height);
    const { index, progress } = sceneAt(input.timeline, input.time);
    const scene = input.script.scenes[index];
    if (scene) {
      // Cảnh kết chiếm cả khung, không có thanh tiêu đề cảnh.
      const isOutro = scene.visual.kind === 'outro';
      if (!isOutro) paintHeader(ctx, scene, index, input.script.scenes.length, env);
      ctx.save();
      try {
        ctx.textAlign = 'left';
        paintVisual(ctx, scene.visual, isOutro ? { x: 0, y: 0, w: size.width, h: size.height } : visual, progress, env);
      } finally {
        ctx.restore();
      }
    }
    const cue = input.burnSubtitles ? cueAt(input.timeline.cues, input.time) : null;
    if (cue) paintSubtitle(ctx, cue, env);
  } finally {
    ctx.restore();
  }
}
