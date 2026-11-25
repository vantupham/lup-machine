import { z } from 'zod';

/**
 * Sổ tay khám phá: học sinh ghi lại điều quan sát được và lời giải thích ở từng bước của dự án.
 * Bước được gọi bằng tên ngắn (data, represent…) để dùng chung cho mọi loại dự án.
 */
export const NOTE_TEXT_MAX_LENGTH = 2000;
export const MAX_NOTES_PER_PROJECT = 20;

export const noteStepSchema = z.string().regex(/^[a-z][a-z-]{0,29}$/);

export const noteSchema = z
  .object({
    step: noteStepSchema,
    text: z.string().trim().min(1).max(NOTE_TEXT_MAX_LENGTH),
  })
  .strict();

export type Note = z.infer<typeof noteSchema>;

/** Tệp notebook.json trong .lup: mỗi bước tối đa một ghi chép. */
export const notesFileSchema = z
  .object({
    notes: z
      .array(noteSchema)
      .max(MAX_NOTES_PER_PROJECT)
      .refine((notes) => new Set(notes.map((n) => n.step)).size === notes.length, 'Mỗi bước chỉ có một ghi chép'),
  })
  .strict();
