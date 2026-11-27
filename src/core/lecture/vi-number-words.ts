/**
 * Đọc số thành chữ tiếng Việt cho lời giảng: giọng máy đọc "72,2%" không ổn định,
 * nên lời đọc luôn viết số bằng chữ ("bảy mươi hai phẩy hai phần trăm"), còn phụ đề giữ chữ số.
 * Theo cách đọc phổ thông: "linh" cho hàng chục bằng 0, "mốt" / "tư" / "lăm" sau "mươi".
 */
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'] as const;
const GROUP_NAMES = ['', 'nghìn', 'triệu', 'tỷ'] as const;

function digit(n: number): string {
  return DIGITS[n] ?? '';
}

/** Đọc một nhóm ba chữ số (0–999). `full`: nhóm đứng sau nhóm khác nên phải đọc đủ "không trăm", "linh". */
function readTriple(n: number, full: boolean): string[] {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  const words: string[] = [];
  if (hundreds > 0 || full) words.push(digit(hundreds), 'trăm');
  if (tens === 0) {
    if (units > 0 && words.length > 0) words.push('linh');
  } else if (tens === 1) {
    words.push('mười');
  } else {
    words.push(digit(tens), 'mươi');
  }
  if (units === 0) return words;
  if (units === 1 && tens >= 2) words.push('mốt');
  else if (units === 4 && tens >= 2) words.push('tư');
  else if (units === 5 && tens >= 1) words.push('lăm');
  else words.push(digit(units));
  return words;
}

export function integerToWords(value: number): string {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Không đọc được số ${value}`);
  if (value === 0) return digit(0);
  if (value < 0) return `âm ${integerToWords(-value)}`;

  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  if (groups.length > GROUP_NAMES.length) throw new RangeError(`Số quá lớn: ${value}`);

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i] ?? 0;
    if (group === 0) continue;
    const isLeading = words.length === 0;
    words.push(...readTriple(group, !isLeading));
    const name = GROUP_NAMES[i];
    if (name) words.push(name);
  }
  return words.join(' ');
}

const DECIMAL = /^(-?)(\d+)(?:[.,](\d+))?$/;
/** Dài hơn ngần này chữ số (quá hàng trăm tỷ) thì đọc từng chữ số, như đọc số điện thoại. */
const MAX_WHOLE_DIGITS = 12;
/** Phần thập phân dài hơn ngần này thì đọc từng chữ số ("3,14159" → "ba phẩy một bốn một năm chín"). */
const MAX_FRACTION_AS_NUMBER = 3;

function digitByDigit(digits: string): string {
  return [...digits].map((d) => digit(Number(d))).join(' ');
}

/** Phần nguyên viết dạng chuỗi: "007" hay chuỗi rất dài đọc từng chữ số. */
function wholeToWords(digits: string): string {
  if ((digits.length > 1 && digits.startsWith('0')) || digits.length > MAX_WHOLE_DIGITS) return digitByDigit(digits);
  return integerToWords(Number(digits));
}

/** Đọc số thập phân viết dạng chuỗi ("72,2" hoặc "72.2"), đúng như đang hiển thị. */
export function decimalToWords(text: string): string {
  const match = DECIMAL.exec(text.trim());
  if (!match) throw new RangeError(`Không phải số: ${text}`);
  const [, sign = '', whole = '0', fraction] = match;
  const parts = [wholeToWords(whole)];
  if (fraction) {
    const isDigitByDigit = fraction.startsWith('0') || fraction.length > MAX_FRACTION_AS_NUMBER;
    parts.push('phẩy', isDigitByDigit ? digitByDigit(fraction) : integerToWords(Number(fraction)));
  }
  return `${sign ? 'âm ' : ''}${parts.join(' ')}`;
}

/** Số tiếng Việt có dấu chấm tách nghìn: "1.280", "2.257.984". */
const VI_GROUPED = /^\d{1,3}(?:\.\d{3})+$/;

/** Cụm chữ số trong chữ tiếng Việt: dấu chấm theo nhóm ba là tách nghìn, còn lại "." / "," là dấu thập phân. */
export function viNumberTextToWords(token: string): string {
  return VI_GROUPED.test(token) ? wholeToWords(token.replaceAll('.', '')) : decimalToWords(token);
}

/** Tìm các cụm số đứng riêng trong chữ tự do (không dính vào chữ cái: "V2" giữ nguyên). */
export const VI_NUMBER_IN_TEXT = /(?<![\p{L}\d])(?:\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(?![\p{L}\d])/gu;

/** Đọc mọi cụm số đứng riêng trong một câu thành chữ ("Lớp 1" → "Lớp một"). */
export function speakNumbersInText(text: string): string {
  return text.replace(VI_NUMBER_IN_TEXT, (match) => viNumberTextToWords(match));
}

/** Tỉ lệ 0–1 → lời đọc phần trăm, làm tròn như khi hiển thị và bỏ đuôi ",0". */
export function percentToWords(fraction: number, fractionDigits: number): string {
  const text = String(Number((fraction * 100).toFixed(fractionDigits)));
  return `${decimalToWords(text)} phần trăm`;
}
