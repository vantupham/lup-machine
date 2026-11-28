import type { TFunction } from 'i18next';
import { decimalToWords, speakNumbersInText } from '@/core/lecture/vi-number-words';
import type { NarrationLine } from './lecture-script';

/** Một giá trị điền vào mẫu câu: dạng hiển thị và dạng đọc. */
export interface Spoken {
  readonly display: string;
  readonly spoken: string;
}

export type LineVars = Readonly<Record<string, string | number | Spoken>>;

export interface LectureFormat {
  count(n: number): Spoken;
  /** Tỉ lệ 0–1 → phần trăm, tối đa `digits` chữ số thập phân. */
  percent(fraction: number, digits?: number): Spoken;
  /** Số thập phân bất kỳ (sai số, tốc độ học). */
  decimal(value: number, digits: number): Spoken;
  /** Chênh lệch hai tỉ lệ tính bằng điểm phần trăm. */
  points(fraction: number): Spoken;
  /** Tên riêng có chữ số: hiển thị nguyên dạng, đọc theo cách viết riêng cho tiếng Việt. */
  term(display: string, viSpoken: string): Spoken;
  list(items: readonly string[]): string;
  line(key: string, vars?: LineVars): NarrationLine;
}

export function lectureFormat(t: TFunction, language: string): LectureFormat {
  const isVietnamese = language.startsWith('vi');
  const spoken = (display: string, words: () => string): Spoken => ({ display, spoken: isVietnamese ? words() : display });

  /** Làm tròn MỘT lần rồi suy ra cả hai dạng, để chữ trên hình và lời đọc luôn cùng một số. */
  const number = (value: number, digits: number, suffix = '', spokenSuffix = ''): Spoken => {
    if (!Number.isFinite(value)) {
      const unknown = t('lecture.unknown');
      return { display: unknown, spoken: unknown };
    }
    const rounded = Number(value.toFixed(digits));
    const display = `${rounded.toLocaleString(language, { maximumFractionDigits: digits })}${suffix}`;
    const plain = String(rounded).includes('e') ? rounded.toFixed(digits) : String(rounded);
    return spoken(display, () => `${decimalToWords(plain)}${spokenSuffix}`);
  };

  const pick = (vars: LineVars, field: keyof Spoken) =>
    Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === 'object' ? v[field] : v]));

  return {
    count: (n) => number(n, 0),
    percent: (fraction, digits = 1) => number(fraction * 100, digits, '%', ' phần trăm'),
    decimal: (value, digits) => number(value, digits),
    points: (fraction) => number(fraction * 100, 1),
    term: (display, viSpoken) => spoken(display, () => viSpoken),
    list: (items) => new Intl.ListFormat(language, { type: 'conjunction' }).format(items),
    line: (key, vars = {}) => {
      const display = t(key, pick(vars, 'display'));
      return { display, spoken: isVietnamese ? speakNumbersInText(t(key, pick(vars, 'spoken'))) : display };
    },
  };
}
