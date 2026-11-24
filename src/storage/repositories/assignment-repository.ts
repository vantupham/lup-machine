import type { AssignmentRecord, LupDatabase } from '../db';
import { alignAnswers, answersSchema, assignmentSchema, parseAssignment, type Assignment } from '../schemas/assignment';

export interface ProjectAssignment {
  readonly projectId: string;
  readonly assignment: Assignment;
  /** Câu trả lời phiếu thí nghiệm, cùng thứ tự với `assignment.questions`. */
  readonly answers: readonly string[];
  readonly updatedAt: string;
}

/** Bài tập (từ gói .lupa) gắn với một dự án của học sinh. */
export interface AssignmentRepository {
  get(projectId: string): Promise<ProjectAssignment | null>;
  attach(projectId: string, assignment: Assignment): Promise<void>;
  saveAnswers(projectId: string, answers: readonly string[]): Promise<ProjectAssignment>;
}

function toProjectAssignment(record: AssignmentRecord): ProjectAssignment | null {
  const assignment = parseAssignment(record.assignment);
  const answers = answersSchema.safeParse(record.answers);
  if (!assignment || !answers.success) return null;
  return { projectId: record.projectId, assignment, answers: alignAnswers(assignment.questions, answers.data), updatedAt: record.updatedAt };
}

export function createDexieAssignmentRepository(db: LupDatabase, now: () => string = () => new Date().toISOString()): AssignmentRepository {
  return {
    async get(projectId) {
      const record = await db.assignments.get(projectId);
      return record ? toProjectAssignment(record) : null;
    },

    async attach(projectId, input) {
      const assignment = assignmentSchema.parse(input);
      await db.assignments.put({ projectId, assignment, answers: alignAnswers(assignment.questions, []), updatedAt: now() });
    },

    async saveAnswers(projectId, input) {
      return db.transaction('rw', db.assignments, async () => {
        const record = await db.assignments.get(projectId);
        const current = record ? toProjectAssignment(record) : null;
        if (!current) throw new Error('Dự án này không gắn với bài tập nào');
        const answers = alignAnswers(current.assignment.questions, answersSchema.parse(input));
        const updated: AssignmentRecord = { projectId, assignment: current.assignment, answers, updatedAt: now() };
        await db.assignments.put(updated);
        return { ...current, answers, updatedAt: updated.updatedAt };
      });
    },
  };
}
