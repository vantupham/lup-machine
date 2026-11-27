/**
 * Phụ đề cho video bài giảng: chia lời giảng thành từng đoạn ngắn, gán thời gian theo số âm tiết
 * (tiếng Việt mỗi âm tiết cách nhau một dấu cách), rồi xuất SRT / WebVTT.
 */

/** Tốc độ đọc đo được với giọng Piper vais1000 (docs/ke-hoach/Video-bai-giang-spike.md). */
export const SPEECH_SYLLABLES_PER_SECOND = 4.6;

export interface Cue {
  /** Giây, tính từ đầu video. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const SENTENCE_BREAK = /(?<=[.?!…])\s+/;
const CLAUSE_BREAK = /(?<=[,;:])\s+/;

function countSyllables(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

type Fits = (text: string) => boolean;

/**
 * Ngắt một đoạn phụ đề thành dòng không dài quá `lineChars`: ưu tiên hai dòng dài gần bằng nhau.
 * Một từ dài hơn cả dòng vẫn đứng riêng một dòng (không cắt giữa từ).
 */
export function wrapLines(text: string, lineChars: number): string[] {
  if (text.length <= lineChars) return [text];
  let best: [string, string] | null = null;
  for (let i = text.indexOf(' '); i >= 0; i = text.indexOf(' ', i + 1)) {
    const pair: [string, string] = [text.slice(0, i), text.slice(i + 1)];
    if (pair[0].length > lineChars || pair[1].length > lineChars) continue;
    if (!best || Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length)) best = pair;
  }
  return best ?? pack(text.split(' '), (line) => line.length <= lineChars);
}

/** Ghép các mẩu liền nhau (cách bởi dấu cách) chừng nào đoạn ghép còn vừa. */
function pack(pieces: readonly string[], fits: Fits): string[] {
  const out: string[] = [];
  let current = '';
  for (const piece of pieces) {
    const joined = current ? `${current} ${piece}` : piece;
    if (!current || fits(joined)) {
      current = joined;
    } else {
      out.push(current);
      current = piece;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Cắt theo từ thành ít đoạn nhất có thể, các đoạn dài gần bằng nhau (tránh đuôi một hai chữ). */
function splitWordsEvenly(text: string, cueChars: number, fits: Fits): string[] {
  const words = text.split(' ');
  for (let parts = Math.ceil(text.length / cueChars); parts <= words.length; parts++) {
    const target = Math.ceil(text.length / parts);
    const out: string[] = [];
    let current = '';
    for (const word of words) {
      const joined = current ? `${current} ${word}` : word;
      if (current && (!fits(joined) || (current.length >= target && out.length < parts - 1))) {
        out.push(current);
        current = word;
      } else {
        current = joined;
      }
    }
    out.push(current);
    if (out.length <= parts) return out;
  }
  return words;
}

function splitLong(text: string, cueChars: number, fits: Fits): string[] {
  const clauses = text.split(CLAUSE_BREAK).flatMap((clause) => (fits(clause) ? [clause] : splitWordsEvenly(clause, cueChars, fits)));
  return pack(clauses, fits);
}

/**
 * Chia lời thành các đoạn phụ đề, mỗi đoạn ngắt được thành tối đa `maxLines` dòng `lineChars` ký tự:
 * mỗi câu một đoạn; câu dài tách theo dấu phẩy rồi theo từ.
 * Không bao giờ cắt giữa một từ; nối các đoạn bằng dấu cách ra lại đúng lời ban đầu.
 */
export function splitCueTexts(text: string, lineChars: number, maxLines = 1): string[] {
  if (!Number.isInteger(lineChars) || lineChars < 1) throw new RangeError(`lineChars không hợp lệ: ${lineChars}`);
  if (!Number.isInteger(maxLines) || maxLines < 1) throw new RangeError(`maxLines không hợp lệ: ${maxLines}`);
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const fits: Fits = (cue) => wrapLines(cue, lineChars).length <= maxLines;
  const cueChars = lineChars * maxLines;
  return normalized.split(SENTENCE_BREAK).flatMap((sentence) => (fits(sentence) ? [sentence] : splitLong(sentence, cueChars, fits)));
}

/** Ước lượng thời gian đọc khi chưa có âm thanh thật (xem trước, chế độ không lời). */
export function estimateSpeechSeconds(spoken: string): number {
  return countSyllables(spoken) / SPEECH_SYLLABLES_PER_SECOND;
}

/**
 * Gán thời gian: chia `duration` giây theo tỉ lệ độ dài đọc (mặc định: số âm tiết),
 * đoạn cuối kết thúc đúng `start + duration`.
 */
export function timeCues(texts: readonly string[], start: number, duration: number, weigh: (text: string) => number = countSyllables): Cue[] {
  const weights = texts.map((text) => Math.max(1, weigh(text)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const end = start + duration;
  let elapsed = 0;
  return texts.map((text, i) => {
    const cueStart = start + (duration * elapsed) / total;
    elapsed += weights[i] ?? 1;
    const cueEnd = i === texts.length - 1 ? end : start + (duration * elapsed) / total;
    return { start: cueStart, end: cueEnd, text };
  });
}

function timestamp(seconds: number, separator: ',' | '.'): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms % 1000, 3)}`;
}

/** Lời thoại chứa "-->" làm hỏng tệp phụ đề. */
function cueText(text: string): string {
  return text.replaceAll('-->', '→');
}

export function toSrt(cues: readonly Cue[]): string {
  return cues.map((cue, i) => `${i + 1}\n${timestamp(cue.start, ',')} --> ${timestamp(cue.end, ',')}\n${cueText(cue.text)}\n`).join('\n');
}

export function toVtt(cues: readonly Cue[]): string {
  const body = cues.map((cue) => `${timestamp(cue.start, '.')} --> ${timestamp(cue.end, '.')}\n${cueText(cue.text)}\n`).join('\n');
  return `WEBVTT\n\n${body}`;
}
