import { runKmeans } from '@/core/algorithms/kmeans';
import { buildFrames } from './kmeans-view';

describe('buildFrames', () => {
  const points = [[0, 0], [0, 1], [5, 5], [5, 6], [0.5, 0.5]];
  const history = runKmeans(points, [[0, 0], [0, 1]], 50);
  const frames = buildFrames(history);

  test('khung đầu là khởi tạo: chưa gán nhãn', () => {
    expect(frames[0]!.phase).toBe('init');
    expect(frames[0]!.labels).toBeNull();
  });

  test('các pha xen kẽ gán → dời, khung dời có tâm cũ để vẽ mũi tên', () => {
    expect(frames.slice(1).map((f) => f.phase)).toEqual(
      history.flatMap((_, i) => (i < history.length - 1 ? ['assign', 'update'] : ['assign'])),
    );
    const update = frames.find((f) => f.phase === 'update')!;
    expect(update.previousCenters).not.toBeNull();
  });

  test('chỉ khung cuối được đánh dấu hội tụ, và khớp kết quả cuối của k-means', () => {
    expect(frames.filter((f) => f.converged)).toHaveLength(1);
    const last = frames.at(-1)!;
    expect(last.converged).toBe(true);
    expect(last.labels).toEqual(history.at(-1)!.labels);
  });

  test('lịch sử rỗng thì không có khung nào', () => {
    expect(buildFrames([])).toEqual([]);
  });
});
