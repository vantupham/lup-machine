import { z } from 'zod';
import { CLASS_NAME_MAX_LENGTH } from '../repositories/dataset-repository';
import { newRunSchema } from '../repositories/experiment-repository';
import { TABLE_FILE_NAME_MAX_LENGTH } from '../repositories/table-repository';

/** Tên các tệp JSON bên trong tệp dự án .lup (dữ liệu nhị phân nằm trong samples/ và audio/). */
export const BUNDLE_FILES = {
  manifest: 'manifest.json',
  classes: 'classes.json',
  images: 'images.json',
  audio: 'audio.json',
  poses: 'poses.json',
  tableCsv: 'table.csv',
  table: 'table.json',
  runs: 'runs.json',
} as const;

export const MAX_BUNDLE_CLASSES = 50;

const classIndex = z.number().int().min(0).max(MAX_BUNDLE_CLASSES - 1);
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);
const fileName = (pattern: RegExp) => z.string().regex(pattern);

export const IMAGE_FILE_PATTERN = /^samples\/\d{5}\.(jpg|png)$/;
export const AUDIO_FILE_PATTERN = /^audio\/\d{5}\.wav$/;

export const classesFileSchema = z
  .object({ classes: z.array(z.string().trim().min(1).max(CLASS_NAME_MAX_LENGTH)).max(MAX_BUNDLE_CLASSES) })
  .strict();

export const creditSchema = z
  .object({
    author: z.string().min(1).max(200),
    source: httpsUrl,
    license: z.string().min(1).max(100),
    licenseUrl: httpsUrl,
  })
  .strict();

export const imagesFileSchema = z
  .object({
    items: z.array(
      z
        .object({
          file: fileName(IMAGE_FILE_PATTERN),
          class: classIndex,
          split: z.enum(['train', 'test']),
          source: z.enum(['upload', 'webcam', 'dataset']),
          width: z.number().int().min(1).max(1024),
          height: z.number().int().min(1).max(1024),
          credit: creditSchema.optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const audioFileSchema = z
  .object({
    items: z.array(
      z.object({ file: fileName(AUDIO_FILE_PATTERN), class: classIndex, source: z.enum(['microphone', 'upload', 'dataset']) }).strict(),
    ),
  })
  .strict();

export const posesFileSchema = z
  .object({
    items: z.array(
      z
        .object({
          class: classIndex,
          kind: z.enum(['body', 'hand']),
          source: z.enum(['webcam', 'upload', 'dataset']),
          keypoints: z.array(z.number().finite()).max(200),
          width: z.number().positive().max(10_000),
          height: z.number().positive().max(10_000),
        })
        .strict(),
    ),
  })
  .strict();

export const tableFileSchema = z
  .object({
    fileName: z.string().max(TABLE_FILE_NAME_MAX_LENGTH),
    sampleId: z.string().regex(/^[a-z0-9-]{1,60}$/).nullable(),
    /** Cấu hình kiểm tra lại bằng schema của dự án bảng / văn bản khi nhập; sai thì bỏ (null). */
    config: z.unknown(),
  })
  .strict();

export const runsFileSchema = z
  .object({
    runs: z.array(
      newRunSchema
        .omit({ projectId: true })
        .extend({
          number: z.number().int().min(1).max(1_000_000),
          classNames: z.array(z.string().max(CLASS_NAME_MAX_LENGTH)).min(2).max(MAX_BUNDLE_CLASSES),
          metrics: newRunSchema.shape.metrics.max(500),
          createdAt: z.iso.datetime(),
          /** Lần chạy này dùng đúng dữ liệu đang có trong dự án lúc xuất → chạy lại được sau khi nhập. */
          matchesData: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
