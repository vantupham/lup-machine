import { z } from 'zod';

export const TABULAR_MODEL_KINDS = ['logistic', 'tree', 'knn', 'linear', 'knn-regression'] as const;
export type TabularModelKind = (typeof TABULAR_MODEL_KINDS)[number];

export const tabularModelSettingsSchema = z
  .object({
    kind: z.enum(TABULAR_MODEL_KINDS),
    /** Hồi quy logistic: C (nghịch đảo độ mạnh điều chuẩn). */
    c: z.number().positive().max(1e6),
    /** Cây quyết định: độ sâu tối đa. */
    maxDepth: z.number().int().min(1).max(20),
    criterion: z.enum(['gini', 'entropy']),
    /** k-NN: số láng giềng. */
    k: z.number().int().min(1).max(50),
  })
  .strict();

export const tabularConfigSchema = z
  .object({
    target: z.string().min(1).max(60),
    features: z.array(z.string().min(1).max(60)).max(40),
    task: z.enum(['classification', 'regression']),
    testRatio: z.number().min(0.1).max(0.5),
    seed: z.number().int().min(0).max(2 ** 31 - 1),
    model: tabularModelSettingsSchema,
  })
  .strict();

export type TabularModelSettings = z.infer<typeof tabularModelSettingsSchema>;
export type TabularConfig = z.infer<typeof tabularConfigSchema>;

/** Đọc cấu hình đã lưu; dữ liệu hỏng hoặc từ phiên bản khác thì bỏ qua (trả về null). */
export function parseTabularConfig(input: unknown): TabularConfig | null {
  const result = tabularConfigSchema.safeParse(input);
  return result.success ? result.data : null;
}
