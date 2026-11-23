/** Tính các bản đồ hiển thị cho mạng nơ-ron mini trên lưới của mặt phẳng 2D. */
import { forward, type Mlp } from '@/core/algorithms/mlp';
import { gridCellCenter, type GridSpec } from '@/core/algorithms/knn';

export interface RegionMap {
  readonly labels: number[];
  /** Xác suất của lớp thắng ở mỗi ô (0..1). */
  readonly confidence: number[];
}

export function squareGrid(domain: number, resolution: number): GridSpec {
  return { xMin: -domain, xMax: domain, yMin: -domain, yMax: domain, resolution };
}

function eachCell<T>(spec: GridSpec, fn: (point: [number, number]) => T): T[] {
  const out: T[] = [];
  for (let row = 0; row < spec.resolution; row++) {
    for (let col = 0; col < spec.resolution; col++) out.push(fn(gridCellCenter(spec, col, row)));
  }
  return out;
}

export function regionMap(net: Mlp, spec: GridSpec): RegionMap {
  const probas = eachCell(spec, (p) => forward(net, p).at(-1) as number[]);
  return {
    labels: probas.map((p) => p.indexOf(Math.max(...p))),
    confidence: probas.map((p) => Math.max(...p)),
  };
}

/**
 * Đầu ra của từng nơ-ron ẩn trên lưới: maps[tầng][nơ-ron][ô].
 * Tầng 0 ở đây là tầng ẩn đầu tiên.
 */
export function hiddenNeuronMaps(net: Mlp, spec: GridSpec): number[][][] {
  const perCell = eachCell(spec, (p) => forward(net, p).slice(1, -1));
  const hiddenSizes = net.sizes.slice(1, -1);
  return hiddenSizes.map((size, l) =>
    Array.from({ length: size }, (_, j) => perCell.map((layers) => layers[l]![j] as number)),
  );
}
