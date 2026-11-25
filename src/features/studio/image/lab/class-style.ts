/** Màu của từng lớp (bảng màu Okabe–Ito, an toàn cho người mù màu); hình đi kèm nằm ở @/ui/ClassMarker. */
export const CLASS_COLORS = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#8C6D1F', '#555555'] as const;

export function colorFor(index: number): string {
  return CLASS_COLORS[index % CLASS_COLORS.length] as string;
}
