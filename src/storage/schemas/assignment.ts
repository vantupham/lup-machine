import { z } from 'zod';
import { PROJECT_TYPES } from './manifest';

/**
 * Gói bài tập (.lupa) do giáo viên tạo và bài nộp (.lups) của học sinh.
 * Lớp học không cần máy chủ: hai bên trao đổi tệp qua Zalo / Drive / USB / LMS.
 */
export const ASSIGNMENT_LIMITS = {
  title: 120,
  teacher: 100,
  instructions: 4000,
  questions: 10,
  question: 300,
  answer: 2000,
  rubric: 12,
  criterion: 120,
  criterionDescription: 500,
  maxPoints: 100,
  students: 200,
  className: 50,
} as const;

export const rubricCriterionSchema = z
  .object({
    criterion: z.string().trim().min(1).max(ASSIGNMENT_LIMITS.criterion),
    description: z.string().trim().max(ASSIGNMENT_LIMITS.criterionDescription),
    maxPoints: z.number().int().min(1).max(ASSIGNMENT_LIMITS.maxPoints),
  })
  .strict();

export const assignmentSchema = z
  .object({
    /** Mã gói (UUID) để giáo viên ghép bài nộp với đúng bài tập. */
    id: z.uuid(),
    title: z.string().trim().min(1).max(ASSIGNMENT_LIMITS.title),
    teacher: z.string().trim().max(ASSIGNMENT_LIMITS.teacher),
    instructions: z.string().trim().max(ASSIGNMENT_LIMITS.instructions),
    projectType: z.enum(PROJECT_TYPES),
    questions: z.array(z.string().trim().min(1).max(ASSIGNMENT_LIMITS.question)).max(ASSIGNMENT_LIMITS.questions),
    rubric: z.array(rubricCriterionSchema).min(1).max(ASSIGNMENT_LIMITS.rubric),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type Assignment = z.infer<typeof assignmentSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;
export type AssignmentDraft = Omit<Assignment, 'id' | 'createdAt'>;

export const answersSchema = z.array(z.string().trim().max(ASSIGNMENT_LIMITS.answer)).max(ASSIGNMENT_LIMITS.questions);

export const submitterSchema = z
  .object({
    students: z.string().trim().min(1).max(ASSIGNMENT_LIMITS.students),
    className: z.string().trim().max(ASSIGNMENT_LIMITS.className),
  })
  .strict();

export type Submitter = z.infer<typeof submitterSchema>;

const fraction = z.number().min(0).max(1);

/** Số liệu tự động của dự án lúc nộp (giống khung "Số liệu tự động" của Thẻ mô hình). */
export const factsSummarySchema = z
  .object({
    projectType: z.enum(PROJECT_TYPES),
    classes: z
      .array(
        z
          .object({
            name: z.string().max(60),
            count: z.number().int().min(0).max(100_000),
            train: z.number().int().min(0).max(100_000).nullable(),
            test: z.number().int().min(0).max(100_000).nullable(),
          })
          .strict(),
      )
      .max(50),
    table: z.object({ rows: z.number().int().min(0), columns: z.number().int().min(0) }).strict().nullable(),
    latestRun: z
      .object({
        number: z.number().int().min(1),
        epochs: z.number().int().min(1),
        trainAccuracy: fraction,
        testAccuracy: fraction.nullable(),
        matchesData: z.boolean(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const submissionSchema = z
  .object({
    assignment: assignmentSchema,
    submitter: submitterSchema,
    answers: answersSchema,
    submittedAt: z.iso.datetime(),
    /** false: học sinh chọn không kèm dữ liệu gốc (ảnh, âm thanh…), chỉ có số liệu, nhật ký và thẻ mô hình. */
    includesData: z.boolean(),
    summary: factsSummarySchema,
  })
  .strict();

export type FactsSummary = z.infer<typeof factsSummarySchema>;
export type Submission = z.infer<typeof submissionSchema>;

export function rubricTotal(rubric: readonly RubricCriterion[]): number {
  return rubric.reduce((sum, c) => sum + c.maxPoints, 0);
}

/** Câu trả lời khớp số câu hỏi: thiếu thì thêm chuỗi rỗng, thừa thì bỏ. */
export function alignAnswers(questions: readonly string[], answers: readonly string[]): string[] {
  return questions.map((_, i) => answers[i] ?? '');
}

export function parseAssignment(input: unknown): Assignment | null {
  const result = assignmentSchema.safeParse(input);
  return result.success ? result.data : null;
}
