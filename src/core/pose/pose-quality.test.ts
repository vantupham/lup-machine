import { checkPoseQuality } from './pose-quality';
import { synthesizePose } from './synthetic-poses';

const pose = (seed: number) => synthesizePose('body', 'arms-up', seed).keypoints.map((k) => ({ ...k, score: 0.9 }));
const many = (label: string, n: number) => Array.from({ length: n }, (_, i) => ({ label, keypoints: pose(i) }));

describe('checkPoseQuality', () => {
  test('dữ liệu tốt: không có vấn đề', () => {
    expect(checkPoseQuality('body', [...many('a', 6), ...many('b', 6)], ['a', 'b'])).toEqual([]);
  });

  test('mẫu không chuẩn hóa được, mẫu thiếu nhiều khớp, nhóm ít mẫu, mất cân bằng', () => {
    const noHips = pose(1).map((k, i) => (i === 11 || i === 12 ? { ...k, score: 0.1 } : k));
    const noLegs = pose(2).map((k, i) => (i >= 12 ? { ...k, score: 0.1 } : k));
    const issues = checkPoseQuality('body', [...many('a', 12), ...many('b', 3), { label: 'b', keypoints: noHips }, { label: 'a', keypoints: noLegs }], ['a', 'b', 'c']);
    expect(issues).toEqual([
      { kind: 'unusable', count: 2 },
      { kind: 'missing-joints', count: 1 },
      { kind: 'few-poses', label: 'b', count: 4 },
      { kind: 'few-poses', label: 'c', count: 0 },
      { kind: 'imbalance', smallest: 'b', smallestCount: 4, largest: 'a', largestCount: 13 },
    ]);
  });
});
