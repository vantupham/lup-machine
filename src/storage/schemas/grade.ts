import { z } from 'zod';
import type { RubricCriterion } from './assignment';

export const GRADE_COMMENT_MAX_LENGTH = 1000;

/** Điểm từng tiêu chí (null: chưa chấm) và nhận xét của giáo viên cho một bài nộp. */
export interface Grade {
  readonly scores: readonly (number | null)[];
  readonly comment: string;
}

export const EMPTY_COMMENT = '';

/** Điểm làm tròn tới 0,25 để tránh số lẻ khó đọc như 2,3333. */
export function roundScore(value: number): number {
  return Math.round(value * 4) / 4;
}

/** Schema điểm phụ thuộc rubric: đúng số tiêu chí, mỗi điểm trong [0, điểm tối đa]. */
export function gradeSchema(rubric: readonly RubricCriterion[]) {
  return z
    .object({
      scores: z
        .array(z.number().finite().min(0).nullable())
        .length(rubric.length)
        .refine((scores) => scores.every((s, i) => s === null || s <= (rubric[i]?.maxPoints ?? 0)), { message: 'Điểm vượt quá điểm tối đa của tiêu chí' }),
      comment: z.string().trim().max(GRADE_COMMENT_MAX_LENGTH),
    })
    .strict();
}

export function emptyGrade(rubric: readonly RubricCriterion[]): Grade {
  return { scores: rubric.map(() => null), comment: EMPTY_COMMENT };
}

/** Tổng điểm; null nếu còn tiêu chí chưa chấm. */
export function gradeTotal(grade: Grade): number | null {
  if (grade.scores.some((s) => s === null)) return null;
  return grade.scores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
}

export function isGraded(grade: Grade): boolean {
  return gradeTotal(grade) !== null;
}
