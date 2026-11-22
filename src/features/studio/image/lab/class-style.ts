/** Lớp được phân biệt bằng cả ký hiệu lẫn màu (bảng màu Okabe–Ito, an toàn cho người mù màu). */
export const CLASS_MARKERS = ['●', '▲', '■', '◆', '★', '✚', '⬟', '⬢'] as const;
export const CLASS_COLORS = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#8C6D1F', '#555555'] as const;

export function markerFor(index: number): string {
  return CLASS_MARKERS[index % CLASS_MARKERS.length] as string;
}

export function colorFor(index: number): string {
  return CLASS_COLORS[index % CLASS_COLORS.length] as string;
}
