import { PHOTO_DATASETS } from '@/core/datasets/photo';
import { generateDataset, SAMPLE_DATASETS } from '@/core/datasets/synthetic';
import type { WorksheetRecord } from './types';
import { findLesson, LESSONS } from './index';

describe('Nội dung bài học', () => {
  test('id không trùng và là slug hợp lệ', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  test.each(LESSONS.map((l) => [l.title, l] as const))('%s: cấu trúc đầy đủ và hợp lệ', (_title, lesson) => {
    expect([...SAMPLE_DATASETS, ...PHOTO_DATASETS].some((d) => d.id === lesson.dataset)).toBe(true);
    expect(lesson.goals.length).toBeGreaterThan(0);
    expect(lesson.steps.length).toBeGreaterThan(0);
    expect(lesson.quiz.length).toBeGreaterThanOrEqual(2);
    expect(lesson.minutes).toBeGreaterThan(0);
    for (const q of lesson.quiz) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  test('tìm bài học theo id', () => {
    expect(findLesson('ai-hoc-nham')?.dataset).toBe('background-trap');
    expect(findLesson('khong-co')).toBeUndefined();
  });

  test('bài 4 dùng bộ ảnh thật lá đậu và nói đúng quy mô dữ liệu', () => {
    const lesson = findLesson('bac-si-cay-trong')!;
    expect(lesson.dataset).toBe('beans-3');
    const beans = PHOTO_DATASETS.find((d) => d.id === 'beans-3')!;
    const train = beans.trainPerClass * beans.classKeys.length;
    const test = beans.testPerClass * beans.classKeys.length;
    const text = JSON.stringify(lesson);
    expect(text).toContain(`${train} ảnh`); // "nhớ hết 72 ảnh đã học"
    expect(text).toContain(`chỉ có ${test} ảnh`);
    expect(text).toContain(`${(100 / test).toLocaleString('vi', { maximumFractionDigits: 1 })}%`); // mỗi ảnh ≈ 5,6%
  });

  test('bài 4: số liệu mẫu của bản giáo viên nhất quán với nhau và với bộ dữ liệu', () => {
    const lesson = findLesson('bac-si-cay-trong')!;
    const records = lesson.steps.flatMap((s) => s.record ?? []);
    const beans = PHOTO_DATASETS.find((d) => d.id === 'beans-3')!;
    const total = beans.testPerClass * beans.classKeys.length;
    const num = (v: string) => Number(v.replace(',', '.'));
    const round1 = (v: number) => Math.round(v * 1000) / 10;

    const confusion = records.find((r) => r.kind === 'confusion')!;
    if (confusion.kind !== 'confusion' || !confusion.answers) throw new Error('thiếu ma trận mẫu');
    const m = confusion.answers;
    expect(m).toHaveLength(beans.classKeys.length);
    m.forEach((row) => expect(row.reduce((a, b) => a + b, 0)).toBe(beans.testPerClass)); // mỗi lớp đúng 6 ảnh Kiểm tra
    const correct = m.reduce((a, row, i) => a + row[i]!, 0);

    const epochs = records.find((r) => r.kind === 'table' && r.rows.includes('50'))!;
    if (epochs.kind !== 'table' || !epochs.answers) throw new Error('thiếu bảng epoch mẫu');
    expect(num(epochs.answers[epochs.rows.indexOf('50')]![1]!)).toBe(round1(correct / total)); // đường chéo = điểm Kiểm tra cuối

    const thresholds = records.find((r) => r.kind === 'table' && r.rows.includes('90%'))!;
    if (thresholds.kind !== 'table' || !thresholds.answers) throw new Error('thiếu bảng ngưỡng mẫu');
    const at50 = thresholds.answers[thresholds.rows.indexOf('50%')]!;
    expect(Number(at50[0])).toBe(total); // ngưỡng 50%: với 3 lớp vẫn có thể có ảnh dưới 50%, nhưng lần kiểm chứng trả lời đủ
    expect(Number(at50[1])).toBe(Math.round((correct / total) * 100));
    const answered = thresholds.answers.map((r) => Number(r[0]));
    expect([...answered].sort((a, b) => b - a)).toEqual(answered); // ngưỡng cao hơn → trả lời không nhiều hơn

    const fields = records.find((r) => r.kind === 'fields')!;
    if (fields.kind !== 'fields' || !fields.answers) throw new Error('thiếu ô điền mẫu');
    const off = m.flatMap((row, i) => row.map((v, j) => ({ v, i, j })).filter((c) => c.i !== c.j));
    const worst = off.reduce((a, b) => (b.v > a.v ? b : a));
    expect([worst.i, worst.j]).toEqual([2, 1]); // gỉ sắt → đốm góc
    expect(fields.answers[0]).toContain(`(${worst.v} ảnh)`);
    expect(Number(fields.answers[1])).toBe(m[1]![0]! + m[2]![0]!); // lá bệnh bị đoán là khỏe
  });

  test.each(LESSONS.map((l) => [l.title, l] as const))('%s: số liệu mẫu của bản giáo viên đúng kích thước', (_title, lesson) => {
    const def = [...SAMPLE_DATASETS, ...PHOTO_DATASETS].find((d) => d.id === lesson.dataset)!;
    for (const r of lesson.steps.flatMap((st) => st.record ?? [])) {
      if (r.kind === 'confusion' && r.answers) {
        expect(r.answers).toHaveLength(def.classKeys.length);
        r.answers.forEach((row) => {
          expect(row).toHaveLength(def.classKeys.length);
          expect(row.reduce((a, b) => a + b, 0)).toBe(def.testPerClass);
        });
      }
      if (r.kind === 'table' && r.answers) {
        expect(r.answers).toHaveLength(r.rows.length);
        r.answers.forEach((row) => expect(row).toHaveLength(r.columns.length - 1));
      }
      if (r.kind === 'fields' && r.answers) expect(r.answers).toHaveLength(r.fields.length);
    }
  });

  test('bài 1: màu mẫu khớp màu thật của ảnh đầu tiên (tính từ thông số sinh ảnh, sai số nén JPEG ±6)', () => {
    const records = findLesson('may-tinh-nhin-anh')!.steps.flatMap((st) => st.record ?? []);
    const table = records.find((r): r is Extract<WorksheetRecord, { kind: 'table' }> => r.kind === 'table')!;
    const first = generateDataset(SAMPLE_DATASETS.find((d) => d.id === 'shapes-2')!)[0]!;
    expect(first.classKey).toBe('circle');
    const expected = [hslToRgb(first.shape.background), hslToRgb(first.shape.fill)];
    table.answers!.forEach((row, i) => row.forEach((v, c) => expect(Math.abs(Number(v) - expected[i]![c]!)).toBeLessThanOrEqual(6)));
    expect(JSON.stringify(records)).toContain('150.528');
  });

  test('bài 2: ma trận epoch 5 khớp điểm Kiểm tra epoch 5; ô nhầm nhiều nhất khớp ô điền', () => {
    const records = findLesson('day-may-phan-biet-hinh')!.steps.flatMap((st) => st.record ?? []);
    const m = (records.find((r) => r.kind === 'confusion') as Extract<WorksheetRecord, { kind: 'confusion' }>).answers!;
    const epochs = records.find((r) => r.kind === 'table' && r.rows.includes('5')) as Extract<WorksheetRecord, { kind: 'table' }>;
    const diag = m.reduce((a, row, i) => a + row[i]!, 0);
    expect(Number(epochs.answers![epochs.rows.indexOf('5')]![1]!.replace(',', '.'))).toBe(Math.round((diag / 18) * 1000) / 10);
    const fields = records.find((r) => r.kind === 'fields' && r.fields[0]!.includes('epoch 5')) as Extract<WorksheetRecord, { kind: 'fields' }>;
    expect(fields.answers![0]).toContain(`(${m[1]![2]} ảnh)`);
    expect(m[1]![2]).toBe(Math.max(...m.flatMap((row, i) => row.filter((_, j) => j !== i))));
  });

  test('bài 3: ma trận bẫy (đường chéo 0) khớp điểm Kiểm tra 0%', () => {
    const records = findLesson('ai-hoc-nham')!.steps.flatMap((st) => st.record ?? []);
    const m = (records.find((r) => r.kind === 'confusion') as Extract<WorksheetRecord, { kind: 'confusion' }>).answers!;
    expect(m[0]![0]! + m[1]![1]!).toBe(0);
    const fields = records.find((r) => r.kind === 'fields') as Extract<WorksheetRecord, { kind: 'fields' }>;
    expect(fields.answers).toEqual(['100%', '0%']);
  });

  test('con số trong bài 1 khớp với kích thước ảnh mô hình nhận', () => {
    expect(224 * 224 * 3).toBe(150528);
    expect(JSON.stringify(findLesson('may-tinh-nhin-anh'))).toContain('150.528');
  });
});

/** "hsl(h s% l%)" → [r, g, b] 0–255 (công thức chuẩn CSS). */
function hslToRgb(css: string): [number, number, number] {
  const [h, s, l] = css.match(/[\d.]+/g)!.map(Number) as [number, number, number];
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
