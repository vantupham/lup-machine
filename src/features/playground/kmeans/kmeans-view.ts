/**
 * Chia mỗi vòng k-means thành hai pha để học sinh thấy rõ:
 *   "gán"  – tô màu điểm theo tâm gần nhất;   "dời" – tâm chạy về trung bình cụm của nó.
 */
import type { KmeansStep } from '@/core/algorithms/kmeans';

export type KmeansPhase = 'init' | 'assign' | 'update';

export interface KmeansFrame {
  readonly phase: KmeansPhase;
  /** Số vòng lặp đã hoàn thành. */
  readonly iteration: number;
  readonly centers: readonly (readonly number[])[];
  /** Tâm trước khi dời (chỉ có ở pha "dời"), để vẽ mũi tên. */
  readonly previousCenters: readonly (readonly number[])[] | null;
  /** null ở pha khởi tạo: điểm chưa thuộc cụm nào. */
  readonly labels: readonly number[] | null;
  readonly inertia: number | null;
  readonly converged: boolean;
}

/** Khung 0: tâm khởi đầu. Sau đó xen kẽ gán (khung lẻ) và dời (khung chẵn). */
export function buildFrames(history: readonly KmeansStep[]): KmeansFrame[] {
  const first = history[0];
  if (!first) return [];
  const frames: KmeansFrame[] = [
    { phase: 'init', iteration: 0, centers: first.centers, previousCenters: null, labels: null, inertia: null, converged: false },
  ];
  history.forEach((step, i) => {
    frames.push({ phase: 'assign', iteration: i, centers: step.centers, previousCenters: null, labels: step.labels, inertia: step.inertia, converged: false });
    const next = history[i + 1];
    if (next) {
      frames.push({
        phase: 'update',
        iteration: i + 1,
        centers: next.centers,
        previousCenters: step.centers,
        labels: step.labels,
        inertia: null,
        converged: false,
      });
    }
  });
  // vòng cuối: tâm không đổi → gán lại cho cùng kết quả, đánh dấu hội tụ
  const last = frames.at(-1) as KmeansFrame;
  frames[frames.length - 1] = { ...last, converged: true };
  return frames;
}
