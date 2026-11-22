import { PHOTO_DATASETS } from '@/core/datasets/photo';
import { SAMPLE_DATASETS } from '@/core/datasets/synthetic';
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

  test('con số trong bài 1 khớp với kích thước ảnh mô hình nhận', () => {
    expect(224 * 224 * 3).toBe(150528);
    expect(JSON.stringify(findLesson('may-tinh-nhin-anh'))).toContain('150.528');
  });
});
