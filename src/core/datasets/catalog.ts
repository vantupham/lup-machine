/** Danh mục chung của mọi bộ dữ liệu mẫu (hình vẽ tổng hợp và ảnh thật). */
import { PHOTO_DATASETS, type PhotoDatasetId } from './photo';
import { SAMPLE_DATASETS, type SampleDatasetId } from './synthetic';

export type AnyDatasetId = SampleDatasetId | PhotoDatasetId;

/** Khóa các lớp của một bộ dữ liệu, theo đúng thứ tự lớp trong dự án được tạo ra. */
export function datasetClassKeys(id: AnyDatasetId): readonly string[] {
  const def = [...SAMPLE_DATASETS, ...PHOTO_DATASETS].find((d) => d.id === id);
  if (!def) throw new Error(`Không có bộ dữ liệu ${id}`);
  return def.classKeys;
}
