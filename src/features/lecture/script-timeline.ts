import { VI_NUMBER_IN_TEXT, viNumberTextToWords } from '@/core/lecture/vi-number-words';
import { estimateSpeechSeconds, splitCueTexts, timeCues, wrapLines, type Cue } from '@/core/lecture/subtitles';
import type { AspectRatio, LectureScript, SceneId } from './lecture-script';

/** Nghỉ giữa hai câu trong cùng cảnh và giữa hai cảnh (giây). */
export const LINE_GAP = 0.25;
export const SCENE_GAP = 0.6;
/** Cảnh không có lời đọc (cảnh kết) hiện trong chừng này giây. */
export const SILENT_SCENE_SECONDS = 3.5;
/** Số dòng tối đa của một đoạn phụ đề. */
export const CUE_LINES = 2;

/** Ký tự mỗi dòng phụ đề: khổ dọc hẹp hơn. */
const LINE_CHARS: Readonly<Record<AspectRatio, number>> = { '16:9': 42, '9:16': 28 };

export function subtitleLineChars(aspect: AspectRatio): number {
  return LINE_CHARS[aspect];
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Độ dài đọc của một đoạn phụ đề tiếng Việt: chữ số tính theo số âm tiết khi đọc
 * ("72,2%" = 7, "1.280" = 6). Ngôn ngữ khác tính mỗi từ một nhịp.
 */
export function spokenWeight(text: string, language: string): number {
  if (!language.startsWith('vi')) return countWords(text);
  const percents = (text.match(/\d%/g) ?? []).length;
  const spoken = text.replace(VI_NUMBER_IN_TEXT, (match) => viNumberTextToWords(match)).replace(/%/g, ' ');
  return countWords(spoken) + percents * 2;
}

/**
 * Thời lượng từng câu khi có giọng thu: cảnh đã thu dài đúng bằng bản thu (`recorded[cảnh]` giây),
 * các câu chia phần còn lại sau khoảng nghỉ theo độ dài đọc; cảnh chưa thu thì ước lượng.
 */
export function lineSecondsWithVoices(script: LectureScript, recorded: readonly (number | null | undefined)[]): number[][] {
  return script.scenes.map((scene, s) => {
    const estimates = scene.lines.map((line) => estimateSpeechSeconds(line.spoken));
    const total = recorded[s];
    if (scene.lines.length === 0 || total === null || total === undefined || !(total > 0)) return estimates;
    const gaps = Math.max(0, scene.lines.length - 1) * LINE_GAP;
    const available = Math.max(total - gaps, MIN_LINE_SECONDS * scene.lines.length);
    const weight = estimates.reduce((sum, e) => sum + e, 0);
    return estimates.map((e) => (weight > 0 ? (available * e) / weight : available / scene.lines.length));
  });
}

/** Câu ngắn nhất khi bản thu quá ngắn so với số câu. */
const MIN_LINE_SECONDS = 0.2;

export interface SceneTime {
  readonly id: SceneId;
  readonly start: number;
  readonly end: number;
}

export interface LectureTimeline {
  readonly scenes: readonly SceneTime[];
  /** Chữ của mỗi đoạn đã ngắt dòng bằng "\n" (tối đa CUE_LINES dòng). */
  readonly cues: readonly Cue[];
  readonly duration: number;
}

/**
 * Đặt mốc thời gian cho cả bài: mỗi câu dài bằng âm thanh thật (`lineSeconds[cảnh][câu]`)
 * hoặc ước lượng theo số âm tiết khi chưa có giọng đọc.
 */
export function buildTimeline(script: LectureScript, aspect: AspectRatio, lineSeconds?: readonly (readonly number[])[]): LectureTimeline {
  const lineChars = subtitleLineChars(aspect);
  const weigh = (text: string) => spokenWeight(text, script.language);
  const scenes: SceneTime[] = [];
  const cues: Cue[] = [];
  let clock = 0;
  script.scenes.forEach((scene, s) => {
    const seconds = lineSeconds?.[s];
    if (lineSeconds && seconds?.length !== scene.lines.length) throw new RangeError(`Cảnh ${scene.id}: số thời lượng không khớp số câu`);
    if (s > 0) clock += SCENE_GAP;
    const start = clock;
    if (scene.lines.length === 0) clock += SILENT_SCENE_SECONDS;
    scene.lines.forEach((line, l) => {
      if (l > 0) clock += LINE_GAP;
      const duration = seconds?.[l] ?? estimateSpeechSeconds(line.spoken);
      const timed = timeCues(splitCueTexts(line.display, lineChars, CUE_LINES), clock, duration, weigh);
      cues.push(...timed.map((cue) => ({ ...cue, text: wrapLines(cue.text, lineChars).join('\n') })));
      clock += duration;
    });
    scenes.push({ id: scene.id, start, end: clock });
  });
  return { scenes, cues, duration: clock };
}
