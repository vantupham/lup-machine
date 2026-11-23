/** Danh sách thuật toán của Sân chơi; id cũng là đường dẫn #/playground/:id. */
export const PLAYGROUND_ALGOS = ['knn', 'decision-tree', 'linear-regression', 'gradient-descent', 'k-means', 'neural-network'] as const;

export type PlaygroundAlgo = (typeof PLAYGROUND_ALGOS)[number];

/** Biểu tượng chữ đơn giản cho mỗi thẻ (không dùng ảnh). */
export const ALGO_GLYPHS: Readonly<Record<PlaygroundAlgo, string>> = {
  knn: '◎',
  'decision-tree': '⑂',
  'linear-regression': '╱',
  'gradient-descent': '◡',
  'k-means': '⁂',
  'neural-network': '⋈',
};

export function isPlaygroundAlgo(value: string | undefined): value is PlaygroundAlgo {
  return value !== undefined && (PLAYGROUND_ALGOS as readonly string[]).includes(value);
}
