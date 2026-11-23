import topicsCsv from '@/content/text/chu-de.csv?raw';
import canteenCsv from '@/content/text/can-tin.csv?raw';
import { parseCsv } from '@/core/tabular/csv';
import {
  encodeText,
  evaluateText,
  explainText,
  highlightSpans,
  prepareText,
  relativeScore,
  topTerms,
  trainText,
  type TextData,
  type TextExample,
  type TextModelKind,
} from './text-model';

function examples(csv: string): TextExample[] {
  const r = parseCsv(csv);
  if (!r.ok) throw new Error(r.error);
  return r.table.rows.map(([label, text]) => ({ label: label!, text: text! }));
}

function prepared(csv: string, maxN = 1): TextData {
  const r = prepareText(examples(csv), { testRatio: 0.25, seed: 3, maxN });
  if (!r.ok) throw new Error(r.error.code);
  return r.data;
}

const topics = prepared(topicsCsv);
const canteen = prepared(canteenCsv, 2);
const SETTINGS = { alpha: 1, c: 10 };

describe('prepareText', () => {
  test('chia phân tầng, bộ từ vựng chỉ dựng từ tập Dạy', () => {
    expect(topics.classNames).toEqual(['ẩm thực', 'thể thao', 'thời tiết']);
    expect(topics.train.y.length + topics.test.y.length).toBe(72);
    expect(new Set(topics.test.y)).toEqual(new Set([0, 1, 2]));
    const trainWords = new Set(topics.train.texts.flatMap((t) => encodeText(topics, t).terms));
    expect(topics.vocab.terms.every((t) => trainWords.has(t))).toBe(true);
  });

  test('bỏ câu trống / thiếu nhãn và báo lỗi khi dữ liệu không đủ', () => {
    const rows: TextExample[] = [
      ...Array.from({ length: 4 }, (_, i) => ({ label: 'a', text: `câu a ${i}` })),
      ...Array.from({ length: 4 }, (_, i) => ({ label: 'b', text: `câu b ${i}` })),
      { label: '', text: 'không nhãn' },
      { label: 'a', text: '   ' },
    ];
    const r = prepareText(rows, { testRatio: 0.25, seed: 1, maxN: 1 });
    expect(r.ok && r.data.dropped).toBe(2);
    expect(prepareText(rows.slice(0, 3), { testRatio: 0.2, seed: 1, maxN: 1 })).toMatchObject({ ok: false, error: { code: 'too-few-sentences' } });
    expect(prepareText(rows.slice(0, 4), { testRatio: 0.2, seed: 1, maxN: 1 })).toMatchObject({ ok: false, error: { code: 'too-few-sentences' } });
    const one = Array.from({ length: 8 }, (_, i) => ({ label: 'x', text: `câu ${i}` }));
    expect(prepareText(one, { testRatio: 0.2, seed: 1, maxN: 1 })).toMatchObject({ ok: false, error: { code: 'single-class' } });
    const many = Array.from({ length: 22 }, (_, i) => ({ label: `l${i % 11}`, text: `câu ${i}` }));
    expect(prepareText(many, { testRatio: 0.2, seed: 1, maxN: 1 })).toMatchObject({ ok: false, error: { code: 'too-many-classes', count: 11 } });
  });
});

describe.each<TextModelKind>(['naive-bayes', 'logistic'])('mô hình %s', (kind) => {
  const trainedTopics = trainText(topics, { kind, ...SETTINGS });
  const trainedCanteen = trainText(canteen, { kind, ...SETTINGS });

  test('đoán đúng chủ đề phần lớn câu Kiểm tra (≥ 70%)', () => {
    const ev = evaluateText(trainedTopics, topics);
    expect(ev.testAccuracy).toBeGreaterThanOrEqual(0.7);
    expect(ev.confusion.flat().reduce((a, b) => a + b, 0)).toBe(topics.test.y.length);
  });

  test('giải thích chính xác: phần cố định + tổng đóng góp của từ = điểm của lớp (3 lớp và 2 lớp)', () => {
    for (const [trained, data, text] of [
      [trainedTopics, topics, 'Hôm nay trời mưa to và gió lạnh.'],
      [trainedCanteen, canteen, 'Cơm ngon nhưng phải xếp hàng lâu.'],
    ] as const) {
      const encoded = encodeText(data, text);
      for (let c = 0; c < data.classNames.length; c++) {
        const ex = explainText(trained, data, text, c);
        expect(ex.total).toBeCloseTo(relativeScore(trained, encoded, c), 9);
      }
    }
  });

  test('câu về thời tiết được đoán là "thời tiết", từ "trời" đẩy về phía lớp này', () => {
    const ex = explainText(trainedTopics, topics, 'Trời hôm nay nắng đẹp, gió mát.');
    expect(topics.classNames[ex.predicted]).toBe('thời tiết');
    expect(ex.contributions.find((t) => t.term === 'trời')!.value).toBeGreaterThan(0);
    expect(topTerms(trainedTopics, topics, 2, 15).map((t) => t.term)).toContain('trời');
  });

  test('từ chưa gặp trong tập Dạy được liệt kê và không đóng góp gì', () => {
    const ex = explainText(trainedTopics, topics, 'xyzabc trời');
    expect(ex.unknownTerms).toEqual(['xyzabc']);
    expect(ex.contributions.map((t) => t.term)).toEqual(['trời']);
  });
});

describe('highlightSpans', () => {
  test('giữ nguyên câu gốc; mỗi âm tiết mang đóng góp; tổng khớp phần âm tiết đơn của bảng đóng góp', () => {
    for (const kind of ['naive-bayes', 'logistic'] as const) {
      const trained = trainText(topics, { kind, ...SETTINGS });
      const text = 'Trời mưa, trời lạnh!';
      const spans = highlightSpans(trained, topics, text, 2);
      expect(spans.map((s) => s.text).join('')).toBe(text);
      expect(spans.filter((s) => s.value === null).map((s) => s.text)).toEqual([' ', ', ', ' ', '!']);
      const fromSpans = spans.reduce((s, x) => s + (x.value ?? 0), 0);
      const fromTable = explainText(trained, topics, text, 2).contributions.reduce((s, t) => s + t.value, 0);
      expect(fromSpans).toBeCloseTo(fromTable, 9); // maxN = 1 nên chỉ có âm tiết đơn
    }
  });
});
