import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from './en.json';
import vi from './vi.json';

/**
 * Văn phong giao diện: ngắn, thẳng, không cảm thán. Tiếng Việt đếm theo âm tiết
 * (mỗi chữ cách nhau bởi dấu cách), biến {{...}} tính là một.
 */
const LEAD_MAX = 20;
const HINT_MAX = 25;
const LEAD_KEY = /(lead|intro)$/i;
const HINT_KEY = /(hint|note|tip|description)$/i;
/** Phần Chuyên sâu và hộp "Cách tính" được phép dài hơn: đó là chỗ để giải thích. */
const EXEMPT_PATH = /(Expert|How|Body)/;

type Entry = readonly [path: string, value: string];

function flatten(value: unknown, path = ''): Entry[] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => flatten(v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => flatten(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const syllables = (text: string) => text.replace(/\{\{[^}]+\}\}/g, 'X').trim().split(/\s+/).length;
const lastKey = (path: string) => path.replace(/\[\d+\]$/, '').split('.').at(-1) ?? '';
const show = (entries: readonly Entry[]) => entries.map(([p, v]) => `${p}: ${v}`);

describe.each([
  ['vi', flatten(vi)],
  ['en', flatten(en)],
] as const)('văn phong bản dịch %s', (_lang, entries) => {
  test('không dùng dấu chấm than', () => {
    expect(show(entries.filter(([, v]) => v.includes('!')))).toEqual([]);
  });

  test('không dùng gạch dài nối ý (chỉ cho phép "—" đứng riêng làm ô trống)', () => {
    expect(show(entries.filter(([, v]) => v.includes('—') && v.trim() !== '—'))).toEqual([]);
  });
});

describe('văn phong tiếng Việt', () => {
  const entries = flatten(vi);

  test('không mở đầu mệnh lệnh bằng "Hãy"', () => {
    expect(show(entries.filter(([, v]) => /(^|[\s"(])Hãy\s/.test(v)))).toEqual([]);
  });

  test(`câu dẫn tối đa ${LEAD_MAX} âm tiết`, () => {
    const long = entries.filter(([p, v]) => LEAD_KEY.test(lastKey(p)) && !EXEMPT_PATH.test(p) && syllables(v) > LEAD_MAX);
    expect(show(long)).toEqual([]);
  });

  test(`gợi ý và ghi chú tối đa ${HINT_MAX} âm tiết`, () => {
    const long = entries.filter(([p, v]) => HINT_KEY.test(lastKey(p)) && !EXEMPT_PATH.test(p) && syllables(v) > HINT_MAX);
    expect(show(long)).toEqual([]);
  });

  test('không nhắc tên công cụ phát triển hay sản phẩm khác trong lời dẫn', () => {
    const dev = entries.filter(([, v]) => /(TypeScript|Teachable Machine|Phiên bản \{\{version\}\})/.test(v));
    expect(show(dev)).toEqual([]);
  });
});

describe('văn phong nội dung bài học và Đạo đức AI (src/content)', () => {
  const contentFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return contentFiles(full);
      return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : [];
    });

  test('không mở đầu mệnh lệnh bằng "Hãy"', () => {
    const offenders = contentFiles(join(__dirname, '..', 'content')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .filter((line) => /['"`](?:[^'"`]*[\s.:])?Hãy\s/.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
