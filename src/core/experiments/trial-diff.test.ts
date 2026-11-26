import { diffTrialSetup, isTrialTestChanged, trialVariableCount, type TrialSetupLike } from './trial-diff';

const base: TrialSetupLike = {
  settings: { kind: 'logistic', c: 1, k: 3 },
  split: { testRatio: 0.2, seed: 1 },
  data: { fingerprint: 'f1', train: 16, test: 4, classNames: ['Vỗ tay', 'Huýt sáo'] },
};

describe('so sánh hai lần chạy ở Studio huấn luyện tức thì', () => {
  test('không đổi gì', () => {
    expect(diffTrialSetup(base, base)).toEqual([]);
  });

  test('đổi cài đặt: từng cài đặt là một thứ; cài đặt mới xuất hiện cũng được ghi nhận', () => {
    const changes = diffTrialSetup(base, { ...base, settings: { kind: 'knn', c: 1, k: 5, alpha: 1 } });
    expect(changes).toEqual([
      { kind: 'setting', key: 'kind', from: 'logistic', to: 'knn' },
      { kind: 'setting', key: 'k', from: 3, to: 5 },
      { kind: 'setting', key: 'alpha', from: undefined, to: 1 },
    ]);
    expect(trialVariableCount(changes)).toBe(3);
    expect(isTrialTestChanged(changes)).toBe(false);
  });

  test('đổi seed: tập Kiểm tra đổi (chia ngẫu nhiên lại)', () => {
    const changes = diffTrialSetup(base, { ...base, split: { testRatio: 0.2, seed: 2 } });
    expect(changes).toEqual([{ kind: 'split', key: 'seed', from: 1, to: 2 }]);
    expect(isTrialTestChanged(changes)).toBe(true);
  });

  test('thêm mẫu và đổi tỉ lệ Kiểm tra: dữ liệu và cách chia gộp lại là một thứ', () => {
    const next = { ...base, split: { testRatio: 0.3, seed: 1 }, data: { ...base.data, fingerprint: 'f2', train: 18, test: 8 } };
    const changes = diffTrialSetup(base, next);
    expect(changes).toEqual([
      { kind: 'split', key: 'testRatio', from: 0.2, to: 0.3 },
      { kind: 'trainCount', from: 16, to: 18 },
      { kind: 'testCount', from: 4, to: 8 },
    ]);
    expect(trialVariableCount(changes)).toBe(1);
    expect(isTrialTestChanged(changes)).toBe(true);
  });

  test('thay mẫu mà số lượng giữ nguyên: báo đã thay mẫu, tập Kiểm tra cũng đổi', () => {
    const changes = diffTrialSetup(base, { ...base, data: { ...base.data, fingerprint: 'f9' } });
    expect(changes).toEqual([{ kind: 'samples' }]);
    expect(isTrialTestChanged(changes)).toBe(true);
  });

  test('đổi cài đặt và thêm lớp: hai thứ', () => {
    const changes = diffTrialSetup(base, { ...base, settings: { ...base.settings, c: 10 }, data: { ...base.data, fingerprint: 'f3', classNames: ['Vỗ tay', 'Huýt sáo', 'Gõ bàn'] } });
    expect(changes.map((c) => c.kind)).toEqual(['setting', 'classes']);
    expect(trialVariableCount(changes)).toBe(2);
  });
});
