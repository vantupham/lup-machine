import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Giao diện chỉ dùng icon SVG (lucide-react qua @/ui/icons), không dùng emoji hay ký tự
 * Unicode làm biểu tượng: chúng hiển thị khác nhau giữa các hệ điều hành và phông chữ.
 * Mũi tên vẫn được dùng làm ký hiệu trong câu chữ (ví dụ "ảnh → bảng số"), nhưng không
 * được đứng ở đầu hoặc cuối nhãn như một icon điều hướng.
 */

const SRC = join(__dirname, '..');

/** Emoji, ký hiệu dùng như icon, số trong vòng tròn, hình học và bộ chọn biến thể emoji. */
const ICON_GLYPH = /[\u{1F000}-\u{1FAFF}\u2300-\u23FF\u2460-\u24FF\u25A0-\u27BF\u2B00-\u2BFF]|\uFE0F/u;
/** Mũi tên đứng đầu hoặc cuối một nhãn: vai trò của icon, không phải ký hiệu trong câu. */
const EDGE_ARROW = /^[\u2190-\u21FF]\s|\s[\u2190-\u21FF]$/u;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|json)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

function flatten(value: unknown, path: string, out: [string, string][]): [string, string][] {
  if (typeof value === 'string') out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

describe('không dùng emoji hay ký tự làm icon', () => {
  test('mã nguồn và bản dịch không chứa emoji hay ký hiệu thay icon', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (ICON_GLYPH.test(line) ? [`${relative(SRC, file)}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  test.each(['vi', 'en'])('bản dịch %s không dùng mũi tên làm icon ở đầu hoặc cuối nhãn', (lang) => {
    const strings = flatten(JSON.parse(readFileSync(join(SRC, 'i18n', `${lang}.json`), 'utf8')), '', []);
    expect(strings.filter(([, v]) => EDGE_ARROW.test(v)).map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });
});
