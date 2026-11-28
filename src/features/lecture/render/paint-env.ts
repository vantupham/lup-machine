import type { TFunction } from 'i18next';
import type { SceneVisual } from '../lecture-script';
import type { Ctx } from './canvas-text';
import type { FrameLayout, Rect } from './frame-layout';

/** Những thứ mọi hàm vẽ cảnh cần: chữ theo ngôn ngữ, cỡ chữ của khung, ảnh thu nhỏ đã làm mờ mặt. */
export interface PaintEnv {
  readonly t: TFunction;
  readonly language: string;
  readonly layout: FrameLayout;
  /** Ảnh thu nhỏ theo chỉ số lớp (đã làm mờ khuôn mặt); rỗng khi không có. */
  readonly thumbs: ReadonlyMap<number, readonly CanvasImageSource[]>;
}

export type Painter<K extends SceneVisual['kind']> = (
  ctx: Ctx,
  visual: Extract<SceneVisual, { kind: K }>,
  rect: Rect,
  /** Tiến độ của cảnh, 0 → 1: dùng để hiện dần hình. */
  progress: number,
  env: PaintEnv,
) => void;

export function formatNumber(env: PaintEnv, value: number, digits = 0): string {
  return value.toLocaleString(env.language, { maximumFractionDigits: digits });
}

export function formatPercent(env: PaintEnv, fraction: number, digits = 1): string {
  return `${formatNumber(env, Number((fraction * 100).toFixed(digits)), digits)}%`;
}
