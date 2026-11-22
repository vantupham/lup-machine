/**
 * Bộ ẢNH THẬT có giấy phép mở (khác bộ tổng hợp do máy vẽ).
 * Ảnh đã được xử lý sẵn về 224×224 bằng scripts/build-photo-datasets.py và nằm trong public/datasets/<id>/,
 * kèm manifest.json ghi tác giả, nguồn và giấy phép của TỪNG ẢNH. Manifest được kiểm tra chặt trước khi dùng.
 */
import { z } from 'zod';

export type PhotoDatasetId = 'flowers-3' | 'beans-3';

export interface PhotoDatasetDefinition {
  readonly id: PhotoDatasetId;
  readonly classKeys: readonly string[];
  readonly trainPerClass: number;
  readonly testPerClass: number;
  /** Giấy phép của cả bộ, hiển thị trên thẻ (từng ảnh vẫn ghi nguồn riêng). */
  readonly license: string;
}

export const PHOTO_DATASETS: readonly PhotoDatasetDefinition[] = [
  { id: 'flowers-3', classKeys: ['daisy', 'sunflower', 'rose'], trainPerClass: 24, testPerClass: 6, license: 'CC BY 2.0' },
  { id: 'beans-3', classKeys: ['healthy', 'angular-leaf-spot', 'bean-rust'], trainPerClass: 24, testPerClass: 6, license: 'MIT' },
];

const MAX_TEXT = 200;
const httpsUrl = z
  .string()
  .max(500)
  .refine((v) => /^https:\/\/[^\s]+$/.test(v), 'Chỉ chấp nhận liên kết https');

const creditSchema = z.object({
  author: z.string().trim().min(1).max(MAX_TEXT),
  source: httpsUrl,
  license: z.string().trim().min(1).max(50),
  licenseUrl: httpsUrl,
});

const imageSchema = z.object({
  // Chỉ "lớp/NN.jpg": không có ../, không đường dẫn tuyệt đối, không URL.
  file: z.string().regex(/^[a-z0-9-]+\/\d{2,3}\.jpg$/, 'Đường dẫn ảnh không hợp lệ'),
  class: z.string().regex(/^[a-z0-9-]+$/),
  split: z.enum(['train', 'test']),
  original: z.string().max(MAX_TEXT),
  credit: creditSchema,
});

const manifestSchema = z.object({
  id: z.string(),
  version: z.literal(1),
  size: z.literal(224),
  changes: z.string().max(MAX_TEXT),
  classes: z.array(z.string()).min(2),
  images: z.array(imageSchema).min(1).max(1000),
});

export type PhotoManifest = z.infer<typeof manifestSchema>;
export type PhotoManifestImage = PhotoManifest['images'][number];

export function parsePhotoManifest(json: unknown, expectedId: PhotoDatasetId): PhotoManifest {
  const manifest = manifestSchema.parse(json);
  const def = PHOTO_DATASETS.find((d) => d.id === expectedId);
  if (!def || manifest.id !== expectedId) throw new Error(`Manifest không phải của bộ ${expectedId}`);
  if (manifest.classes.join('|') !== def.classKeys.join('|')) throw new Error(`Các lớp trong manifest không khớp bộ ${expectedId}`);
  const seen = new Set<string>();
  for (const image of manifest.images) {
    if (!def.classKeys.includes(image.class)) throw new Error(`Ảnh ${image.file} thuộc lớp lạ "${image.class}"`);
    if (!image.file.startsWith(`${image.class}/`)) throw new Error(`Ảnh ${image.file} nằm sai thư mục lớp`);
    if (seen.has(image.file)) throw new Error(`Ảnh ${image.file} bị trùng`);
    seen.add(image.file);
  }
  return manifest;
}
