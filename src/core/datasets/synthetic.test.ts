import { generateDataset, SAMPLE_DATASETS, type SampleDatasetId } from './synthetic';

const byId = (id: SampleDatasetId) => SAMPLE_DATASETS.find((d) => d.id === id)!;
const lightness = (hsl: string) => Number(/hsl\(\d+(?:\.\d+)? \d+(?:\.\d+)?% (\d+(?:\.\d+)?)%\)/.exec(hsl)![1]);

describe('Bộ dữ liệu mẫu tổng hợp', () => {
  test('có 3 bộ với id không trùng', () => {
    expect(SAMPLE_DATASETS.map((d) => d.id)).toEqual(['shapes-2', 'shapes-3', 'background-trap']);
  });

  test('cùng seed cho cùng dữ liệu (tái lập)', () => {
    expect(generateDataset(byId('shapes-3'))).toEqual(generateDataset(byId('shapes-3')));
  });

  test.each(SAMPLE_DATASETS.map((d) => [d.id, d] as const))('%s: đúng số ảnh mỗi lớp, mỗi lớp có cả ảnh Huấn luyện và Kiểm tra', (_id, def) => {
    const data = generateDataset(def);
    for (const key of def.classKeys) {
      const ofClass = data.filter((s) => s.classKey === key);
      expect(ofClass).toHaveLength(def.perClass);
      expect(ofClass.some((s) => s.split === 'train')).toBe(true);
      expect(ofClass.some((s) => s.split === 'test')).toBe(true);
    }
  });

  test('hình nằm trọn trong khung 224×224', () => {
    for (const def of SAMPLE_DATASETS) {
      for (const { shape } of generateDataset(def)) {
        expect(shape.cx - shape.size / 2).toBeGreaterThanOrEqual(0);
        expect(shape.cx + shape.size / 2).toBeLessThanOrEqual(224);
        expect(shape.cy - shape.size / 2).toBeGreaterThanOrEqual(0);
        expect(shape.cy + shape.size / 2).toBeLessThanOrEqual(224);
      }
    }
  });

  test('loại hình khớp với lớp', () => {
    for (const s of generateDataset(byId('shapes-3'))) expect(s.shape.kind).toBe(s.classKey);
  });

  test('bẫy nền: Huấn luyện = tròn nền sáng / vuông nền tối; Kiểm tra thì đảo ngược', () => {
    const data = generateDataset(byId('background-trap'));
    const bg = (classKey: string, split: string) =>
      data.filter((s) => s.classKey === classKey && s.split === split).map((s) => lightness(s.shape.background));
    expect(Math.min(...bg('circle', 'train'))).toBeGreaterThan(70);
    expect(Math.max(...bg('square', 'train'))).toBeLessThan(30);
    expect(Math.max(...bg('circle', 'test'))).toBeLessThan(30);
    expect(Math.min(...bg('square', 'test'))).toBeGreaterThan(70);
  });

  test('độ tương phản hình / nền nằm trong khoảng quy định của từng bộ (vẫn nhìn thấy được)', () => {
    for (const def of SAMPLE_DATASETS) {
      for (const { shape } of generateDataset(def)) {
        const diff = Math.abs(lightness(shape.fill) - lightness(shape.background));
        expect(diff).toBeGreaterThanOrEqual(def.contrast[0] - 0.1);
        expect(diff).toBeLessThanOrEqual(def.contrast[1] + 0.1);
        expect(def.contrast[0]).toBeGreaterThanOrEqual(10);
      }
    }
  });
});
