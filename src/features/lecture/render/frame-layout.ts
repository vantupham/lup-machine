import type { AspectRatio } from '../lecture-script';

/** Kích thước khung hình 720p theo từng khổ (đã chốt: mặc định 720p). */
export interface FrameSize {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FrameLayout {
  readonly size: FrameSize;
  /** Tên cảnh và các chấm tiến độ. */
  readonly header: Rect;
  /** Vùng hình minh hoạ của cảnh. */
  readonly visual: Rect;
  /** Dải phụ đề (tối đa 2 dòng). */
  readonly subtitle: Rect;
  /** Cỡ chữ (px) theo vai trò, tính theo cạnh ngắn của khung. */
  readonly fonts: { readonly title: number; readonly body: number; readonly small: number; readonly subtitle: number; readonly hero: number };
}

export const FRAME_SIZES: Readonly<Record<AspectRatio, FrameSize>> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
};

/** Phụ đề 9:16 đặt quanh 72–84% chiều cao: chừa đáy cho nút của ứng dụng điện thoại. */
const PORTRAIT_SUBTITLE_TOP = 0.72;
const PORTRAIT_SUBTITLE_HEIGHT = 0.12;

function fontsFor(shortSide: number): FrameLayout['fonts'] {
  return {
    hero: Math.round(shortSide * 0.12),
    title: Math.round(shortSide * 0.052),
    body: Math.round(shortSide * 0.036),
    small: Math.round(shortSide * 0.028),
    subtitle: Math.round(shortSide * 0.044),
  };
}

export function frameLayout(aspect: AspectRatio): FrameLayout {
  const size = FRAME_SIZES[aspect];
  const short = Math.min(size.width, size.height);
  const margin = Math.round(short * 0.06);
  const fonts = fontsFor(short);
  const headerH = Math.round(fonts.title * 1.8);
  const header = { x: margin, y: margin * 0.7, w: size.width - 2 * margin, h: headerH };
  const visualTop = header.y + headerH + margin * 0.4;

  if (aspect === '16:9') {
    const subtitleH = Math.round(fonts.subtitle * 2.9);
    const subtitle = { x: margin, y: size.height - margin * 0.5 - subtitleH, w: size.width - 2 * margin, h: subtitleH };
    return { size, header, fonts, subtitle, visual: { x: margin, y: visualTop, w: size.width - 2 * margin, h: subtitle.y - visualTop - margin * 0.4 } };
  }
  const subtitle = { x: margin, y: size.height * PORTRAIT_SUBTITLE_TOP, w: size.width - 2 * margin, h: size.height * PORTRAIT_SUBTITLE_HEIGHT };
  return { size, header, fonts, subtitle, visual: { x: margin, y: visualTop, w: size.width - 2 * margin, h: subtitle.y - visualTop - margin * 0.6 } };
}
