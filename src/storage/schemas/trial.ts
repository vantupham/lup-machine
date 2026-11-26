import { z } from 'zod';

/**
 * Một lần huấn luyện ở các Studio huấn luyện tức thì (âm thanh, tư thế, văn bản, bảng số):
 * cài đặt, cách chia dữ liệu, điểm, cùng dự đoán và kết luận của học sinh.
 * (Studio ảnh có nhật ký riêng theo từng epoch: RunRecord.)
 */
export const MAX_TRIALS_PER_PROJECT = 30;
export const TRIAL_CONCLUSION_MAX_LENGTH = 1000;
const MAX_CLASSES = 50;

const fraction = z.number().min(0).max(1);
const settingKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,29}$/);

export const trialMetricSchema = z.enum(['accuracy', 'r2']);
export type TrialMetric = z.infer<typeof trialMetricSchema>;

export const trialSetupSchema = z
  .object({
    /** Cài đặt mô hình và biểu diễn (loại mô hình, C, k, α, cột đặc trưng…): giá trị số hoặc chữ ngắn. */
    settings: z.record(settingKey, z.union([z.number().finite(), z.string().max(400)])).refine((s) => Object.keys(s).length <= 20, 'Tối đa 20 cài đặt'),
    split: z.object({ testRatio: z.number().min(0).max(1), seed: z.number().int() }).strict(),
    data: z
      .object({
        /** Dấu vân tay của dữ liệu (đổi khi thêm, bớt, sửa mẫu). */
        fingerprint: z.string().min(1).max(64),
        train: z.number().int().min(0),
        test: z.number().int().min(0),
        classNames: z.array(z.string().max(100)).max(MAX_CLASSES),
      })
      .strict(),
  })
  .strict();

export type TrialSetup = z.infer<typeof trialSetupSchema>;

export const newTrialSchema = trialSetupSchema
  .extend({
    metric: trialMetricSchema,
    /** Độ chính xác (0–1) hoặc R² (có thể âm); null khi tập đó trống. */
    scores: z.object({ train: z.number().finite().nullable(), test: z.number().finite().nullable() }).strict(),
    /** Tỉ lệ nhận ra từng lớp trên tập Kiểm tra (chỉ với phân loại). */
    classRecall: z.array(fraction.nullable()).max(MAX_CLASSES).optional(),
    /** Điểm Kiểm tra học sinh đoán trước khi huấn luyện (0–1). */
    guess: fraction.optional(),
    conclusion: z.string().trim().min(1).max(TRIAL_CONCLUSION_MAX_LENGTH).optional(),
  })
  .strict();

export type NewTrialInput = z.infer<typeof newTrialSchema>;
