import { z } from 'zod';

export const textConfigSchema = z
  .object({
    kind: z.literal('text'),
    /** Tên cột chứa câu và cột chứa nhãn trong bảng CSV. */
    textColumn: z.string().min(1).max(60),
    labelColumn: z.string().min(1).max(60),
    testRatio: z.number().min(0.1).max(0.5),
    seed: z.number().int().min(0).max(2 ** 31 - 1),
    /** 1 = chỉ âm tiết đơn; 2 = thêm cặp âm tiết liền nhau. */
    maxN: z.union([z.literal(1), z.literal(2)]),
    model: z
      .object({
        kind: z.enum(['naive-bayes', 'logistic']),
        alpha: z.number().positive().max(100),
        c: z.number().positive().max(1e6),
      })
      .strict(),
  })
  .strict();

export type TextConfig = z.infer<typeof textConfigSchema>;

export function parseTextConfig(input: unknown): TextConfig | null {
  const result = textConfigSchema.safeParse(input);
  return result.success ? result.data : null;
}
