import { z } from 'zod';

/** Phiên bản định dạng tệp dự án .lup mà ứng dụng này đọc được. */
export const CURRENT_FORMAT_VERSION = 1;
export const PROJECT_NAME_MAX_LENGTH = 100;

export const PROJECT_TYPES = ['image', 'audio', 'pose', 'text', 'tabular'] as const;

export const manifestSchema = z
  .object({
    formatVersion: z.number().int().min(1).max(CURRENT_FORMAT_VERSION),
    appVersion: z.string().min(1).max(32),
    projectType: z.enum(PROJECT_TYPES),
    name: z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;

export type ParseResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

/** Kiểm tra manifest đọc từ tệp do người dùng cung cấp (dữ liệu không tin cậy). */
export function parseManifest(input: unknown): ParseResult<Manifest> {
  const result = manifestSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  const error = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(gốc)'}: ${issue.message}`)
    .join('; ');
  return { success: false, error };
}
