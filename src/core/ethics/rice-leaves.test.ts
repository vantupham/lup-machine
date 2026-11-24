import {
  accuracy,
  LEAF_PROFILES,
  boundaryLine,
  boundaryYellowAt,
  biasExperimentData,
  EXPERIMENT_SIZES,
  generateLeaves,
  predictLeaf,
  scoreByRegion,
  trainLeafModel,
  type BiasScores,
} from './rice-leaves';

const SEED_OFFSETS = Array.from({ length: 10 }, (_, i) => i * 1000);
const pct = (scores: BiasScores, region?: 'lowland' | 'mountain') => accuracy(region ? scores.byRegion[region] : scores.overall);

function runAll(offset: number) {
  const d = biasExperimentData(offset);
  return {
    biased: scoreByRegion(trainLeafModel(d.trainBiased), d.test),
    balanced: scoreByRegion(trainLeafModel(d.trainBalanced), d.test),
    withRegion: scoreByRegion(trainLeafModel(d.trainBalanced, { useRegion: true }), d.test),
  };
}

describe('bộ dữ liệu lá lúa', () => {
  test('cùng seed cho cùng dữ liệu; số đo nằm trong khoảng hợp lý', () => {
    expect(generateLeaves(5, 'mountain', 20)).toEqual(generateLeaves(5, 'mountain', 20));
    for (const leaf of generateLeaves(5, 'lowland', 200)) {
      expect(leaf.yellow).toBeGreaterThanOrEqual(0);
      expect(leaf.yellow).toBeLessThanOrEqual(100);
      expect(Number.isInteger(leaf.spots) && leaf.spots >= 0).toBe(true);
    }
  });

  test('kích thước thí nghiệm: Dạy lệch 200 Đồng bằng + 20 Miền núi; Kiểm tra cân bằng 100 + 100', () => {
    const d = biasExperimentData();
    const count = (xs: readonly { region: string }[], r: string) => xs.filter((s) => s.region === r).length;
    expect([count(d.trainBiased, 'lowland'), count(d.trainBiased, 'mountain')]).toEqual([2 * EXPERIMENT_SIZES.trainLowland, 2 * EXPERIMENT_SIZES.trainMountainFew]);
    expect(count(d.trainBalanced, 'mountain')).toBe(2 * (EXPERIMENT_SIZES.trainMountainFew + EXPERIMENT_SIZES.trainMountainMore));
    expect([count(d.test, 'lowland'), count(d.test, 'mountain')]).toEqual([100, 100]);
  });

  test('mô hình không biết vùng thì không dùng cột vùng khi dự đoán', () => {
    const model = trainLeafModel(biasExperimentData().trainBiased);
    const leaf = { region: 'lowland' as const, yellow: 40, spots: 3, label: 0 as const };
    expect(predictLeaf(model, leaf)).toBe(predictLeaf(model, { ...leaf, region: 'mountain' }));
  });
});

describe('ranh giới quyết định vẽ trên biểu đồ', () => {
  test('đúng là nơi mô hình đổi kết luận: lệch một chút về hai phía cho hai kết quả khác nhau', () => {
    const d = biasExperimentData();
    for (const useRegion of [false, true]) {
      const model = trainLeafModel(d.trainBalanced, { useRegion });
      for (const region of ['lowland', 'mountain'] as const) {
        const line = boundaryLine(model, region);
        expect(line.a).toBeGreaterThan(0); // càng vàng càng nghiêng về "bệnh"
        const y = boundaryYellowAt(line, 4)!;
        expect(predictLeaf(model, { region, yellow: y - 0.01, spots: 4, label: 0 })).toBe(0);
        expect(predictLeaf(model, { region, yellow: y + 0.01, spots: 4, label: 0 })).toBe(1);
      }
    }
  });

  test('mô hình biết vùng dời ranh giới Miền núi về phía vàng hơn (lá núi vốn vàng)', () => {
    const model = trainLeafModel(biasExperimentData().trainBalanced, { useRegion: true });
    expect(boundaryYellowAt(boundaryLine(model, 'mountain'), 4)!).toBeGreaterThan(boundaryYellowAt(boundaryLine(model, 'lowland'), 4)! + 10);
  });

  test('ranh giới không phụ thuộc độ vàng thì trả về null', () => {
    expect(boundaryYellowAt({ a: 0, b: 1, c: -3 }, 2)).toBeNull();
  });
});

// Mọi khẳng định trong lời bài của Phòng đạo đức AI đều được kiểm tra trên 10 lần lấy mẫu khác nhau.
describe.each(SEED_OFFSETS)('khẳng định của bài, lần lấy mẫu +%i', (offset) => {
  const { biased, balanced, withRegion } = runAll(offset);

  test('① dữ liệu lệch: độ chính xác chung trông ổn (≥ 80%) nhưng Miền núi kém Đồng bằng ít nhất 15 điểm', () => {
    expect(pct(biased)).toBeGreaterThanOrEqual(0.8);
    expect(pct(biased, 'lowland') - pct(biased, 'mountain')).toBeGreaterThanOrEqual(0.15);
  });

  test('① lỗi ở Miền núi đều là báo động nhầm: lá khỏe bị báo bệnh, không bỏ sót lá bệnh nào', () => {
    expect(biased.byRegion.mountain.falseAlarm).toBeGreaterThan(0);
    expect(biased.byRegion.mountain.missed).toBe(0);
  });

  test('① nguyên nhân là độ vàng: nếu lá Miền núi khỏe không vàng hơn lá Đồng bằng, phần lớn báo động nhầm biến mất', () => {
    const d = biasExperimentData(offset);
    const model = trainLeafModel(d.trainBiased);
    const shift = LEAF_PROFILES.mountain[0].yellow[0] - LEAF_PROFILES.lowland[0].yellow[0];
    const healthy = d.test.filter((s) => s.region === 'mountain' && s.label === 0);
    const falseAlarms = healthy.filter((s) => predictLeaf(model, s) === 1).length;
    const ifNotYellower = healthy.filter((s) => predictLeaf(model, { ...s, yellow: s.yellow - shift }) === 1).length;
    expect(falseAlarms).toBeGreaterThan(0);
    expect(ifNotYellower).toBeLessThanOrEqual(falseAlarms / 3);
  });

  test('② thu thêm dữ liệu Miền núi: Miền núi tốt lên, nhưng Đồng bằng giảm, và phần giảm đó chính là do bỏ sót lá bệnh (báo động nhầm không tăng)', () => {
    expect(pct(balanced, 'mountain')).toBeGreaterThan(pct(biased, 'mountain'));
    expect(pct(balanced, 'lowland')).toBeLessThan(pct(biased, 'lowland'));
    const lost = biased.byRegion.lowland.correct - balanced.byRegion.lowland.correct;
    const moreMissed = balanced.byRegion.lowland.missed - biased.byRegion.lowland.missed;
    expect(balanced.byRegion.lowland.falseAlarm).toBeLessThanOrEqual(biased.byRegion.lowland.falseAlarm);
    expect(moreMissed).toBeGreaterThanOrEqual(lost);
  });

  test('③ cho mô hình biết vùng: cả hai vùng đều từ 90% trở lên', () => {
    expect(pct(withRegion, 'lowland')).toBeGreaterThanOrEqual(0.9);
    expect(pct(withRegion, 'mountain')).toBeGreaterThanOrEqual(0.9);
  });
});
