import { colorFor } from '@/features/studio/image/lab/class-style';

/** Màu khung hình video: luôn nền sáng, tương phản cao (không theo chế độ tối của trang). */
export const VIDEO_COLORS = {
  paper: '#f7f5ef',
  surface: '#fffdf8',
  ink: '#1b2433',
  muted: '#5b6474',
  rule: '#d9d4c7',
  primary: '#1d4ed8',
  accent: '#0f766e',
  warning: '#b45309',
  danger: '#b91c1c',
  subtitleBg: 'rgba(17, 24, 39, 0.82)',
  subtitleInk: '#ffffff',
} as const;

export { colorFor as classColor };
