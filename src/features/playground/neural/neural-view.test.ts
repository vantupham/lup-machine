import { forward, initMlp } from '@/core/algorithms/mlp';
import { gridCellCenter } from '@/core/algorithms/knn';
import { createRng } from '@/core/random/seeded-rng';
import { hiddenNeuronMaps, regionMap, squareGrid } from './neural-view';

const net = initMlp([2, 3, 2, 2], 'tanh', createRng(4));
const spec = squareGrid(1, 5);

describe('bản đồ của mạng nơ-ron', () => {
  test('vùng phân loại: mỗi ô là lớp có xác suất lớn nhất', () => {
    const map = regionMap(net, spec);
    expect(map.labels).toHaveLength(25);
    const p = forward(net, gridCellCenter(spec, 2, 1)).at(-1)!;
    expect(map.labels[1 * 5 + 2]).toBe(p.indexOf(Math.max(...p)));
    expect(map.confidence[1 * 5 + 2]).toBeCloseTo(Math.max(...p));
    expect(map.confidence.every((c) => c >= 0.5 && c <= 1)).toBe(true);
  });

  test('bản đồ nơ-ron ẩn: đúng số tầng, số nơ-ron và khớp forward', () => {
    const maps = hiddenNeuronMaps(net, spec);
    expect(maps.map((layer) => layer.length)).toEqual([3, 2]);
    const layers = forward(net, gridCellCenter(spec, 4, 3));
    expect(maps[1]![0]![3 * 5 + 4]).toBeCloseTo(layers[2]![0]!);
  });
});
