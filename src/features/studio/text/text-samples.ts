/** Bộ câu mẫu tiếng Việt do dự án tự soạn (CC BY 4.0), xem src/content/text/README.md. */
export type TextSampleId = 'chu-de' | 'can-tin';

export interface TextSample {
  readonly id: TextSampleId;
  readonly fileName: string;
  readonly sentences: number;
  readonly load: () => Promise<string>;
}

export const TEXT_SAMPLES: readonly TextSample[] = [
  { id: 'chu-de', fileName: 'chu-de.csv', sentences: 72, load: () => import('@/content/text/chu-de.csv?raw').then((m) => m.default) },
  { id: 'can-tin', fileName: 'can-tin.csv', sentences: 80, load: () => import('@/content/text/can-tin.csv?raw').then((m) => m.default) },
];

export function findTextSample(id: string | null): TextSample | null {
  return TEXT_SAMPLES.find((s) => s.id === id) ?? null;
}

/** Tên cột của bảng do trình soạn câu tạo ra. */
export const EDITOR_COLUMNS = { label: 'nhãn', text: 'văn bản' } as const;
