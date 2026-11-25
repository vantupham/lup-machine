/** Danh sách thuật toán của Sân chơi; id cũng là đường dẫn #/playground/:id. */
export const PLAYGROUND_ALGOS = ['knn', 'decision-tree', 'linear-regression', 'gradient-descent', 'k-means', 'neural-network'] as const;

export type PlaygroundAlgo = (typeof PLAYGROUND_ALGOS)[number];

export function isPlaygroundAlgo(value: string | undefined): value is PlaygroundAlgo {
  return value !== undefined && (PLAYGROUND_ALGOS as readonly string[]).includes(value);
}
