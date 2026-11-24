import type { LupDatabase, SubmissionRecord } from '../db';
import type { ProjectBundle } from '../project-file/bundle';
import type { Assignment, RubricCriterion, Submission } from '../schemas/assignment';
import { emptyGrade, gradeSchema, type Grade } from '../schemas/grade';
import type { RepositoryDeps } from './project-repository';

/**
 * Bài nộp giáo viên đã nhận (đã kiểm tra khi mở tệp .lups) và điểm đã chấm.
 * Dự án của học sinh (có thể kèm nhiều ảnh) nằm ở bảng riêng, chỉ đọc khi giáo viên mở nó,
 * để bảng tổng hợp cả lớp không phải nạp toàn bộ dữ liệu vào bộ nhớ.
 */
export type StoredSubmission = SubmissionRecord;

export interface AssignmentSummary {
  readonly assignment: Assignment;
  readonly count: number;
  readonly lastReceivedAt: string;
}

export type AddOutcome = 'added' | 'replaced' | 'older';

/** Bài nộp lưu trên máy giáo viên, nhóm theo bài tập. */
export interface SubmissionRepository {
  listAssignments(): Promise<AssignmentSummary[]>;
  listByAssignment(assignmentId: string): Promise<StoredSubmission[]>;
  /** Dự án đầy đủ của một bài nộp (chỉ đọc khi cần). */
  getProject(id: string): Promise<ProjectBundle | null>;
  /**
   * Cùng bài tập + cùng học sinh cùng lớp: bài mới hơn thay bài cũ (giữ điểm nếu rubric không đổi),
   * bài cũ hơn bị bỏ qua.
   */
  add(submission: Submission, project: ProjectBundle, fileName: string): Promise<{ record: StoredSubmission; outcome: AddOutcome }>;
  saveGrade(id: string, grade: Grade): Promise<StoredSubmission>;
  delete(id: string): Promise<void>;
  deleteAssignment(assignmentId: string): Promise<void>;
}

const defaultDeps: RepositoryDeps = { now: () => new Date().toISOString(), newId: () => crypto.randomUUID() };

const normalize = (text: string) => text.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

/** Khóa so khớp học sinh: họ tên + lớp (hai lớp có thể có hai bạn trùng tên), bỏ khác biệt khoảng trắng / hoa thường. */
export function studentKey(submission: Submission): string {
  return `${normalize(submission.submitter.students)}|${normalize(submission.submitter.className)}`;
}

function sameRubric(a: readonly RubricCriterion[], b: readonly RubricCriterion[]): boolean {
  return a.length === b.length && a.every((c, i) => c.criterion === b[i]?.criterion && c.maxPoints === b[i]?.maxPoints);
}

const collator = new Intl.Collator('vi');

export function createDexieSubmissionRepository(db: LupDatabase, deps: RepositoryDeps = defaultDeps): SubmissionRepository {
  return {
    async listAssignments() {
      const byId = new Map<string, AssignmentSummary>();
      await db.submissions.each((r) => {
        const current = byId.get(r.assignmentId);
        const isNewer = !current || r.receivedAt >= current.lastReceivedAt;
        byId.set(r.assignmentId, {
          // Đề bài theo bài nộp nhận gần nhất.
          assignment: isNewer ? r.submission.assignment : current.assignment,
          count: (current?.count ?? 0) + 1,
          lastReceivedAt: isNewer ? r.receivedAt : current.lastReceivedAt,
        });
      });
      return [...byId.values()].sort(
        (a, b) => b.lastReceivedAt.localeCompare(a.lastReceivedAt) || collator.compare(a.assignment.title, b.assignment.title),
      );
    },

    async listByAssignment(assignmentId) {
      return (await db.submissions.where('assignmentId').equals(assignmentId).toArray()).sort((a, b) =>
        collator.compare(a.submission.submitter.students, b.submission.submitter.students),
      );
    },

    async getProject(id) {
      return (await db.submissionProjects.get(id))?.project ?? null;
    },

    async add(submission, project, fileName) {
      return db.transaction('rw', db.submissions, db.submissionProjects, async () => {
        const key = studentKey(submission);
        const existing = await db.submissions.where('[assignmentId+studentKey]').equals([submission.assignment.id, key]).first();
        if (existing && Date.parse(existing.submission.submittedAt) > Date.parse(submission.submittedAt)) {
          return { record: existing, outcome: 'older' as const };
        }
        const { rubric } = submission.assignment;
        const keepGrade = existing && sameRubric(existing.submission.assignment.rubric, rubric);
        const record: SubmissionRecord = {
          id: existing?.id ?? deps.newId(),
          assignmentId: submission.assignment.id,
          studentKey: key,
          fileName,
          receivedAt: deps.now(),
          submission,
          modelCard: project.modelCard,
          grade: keepGrade ? existing.grade : emptyGrade(rubric),
        };
        await db.submissions.put(record);
        await db.submissionProjects.put({ id: record.id, project });
        return { record, outcome: existing ? ('replaced' as const) : ('added' as const) };
      });
    },

    async saveGrade(id, input) {
      return db.transaction('rw', db.submissions, async () => {
        const record = await db.submissions.get(id);
        if (!record) throw new Error(`Không tìm thấy bài nộp: ${id}`);
        const grade = gradeSchema(record.submission.assignment.rubric).parse(input);
        const updated: SubmissionRecord = { ...record, grade };
        await db.submissions.put(updated);
        return updated;
      });
    },

    async delete(id) {
      await db.transaction('rw', db.submissions, db.submissionProjects, async () => {
        await db.submissionProjects.delete(id);
        await db.submissions.delete(id);
      });
    },

    async deleteAssignment(assignmentId) {
      await db.transaction('rw', db.submissions, db.submissionProjects, async () => {
        const ids = (await db.submissions.where('assignmentId').equals(assignmentId).primaryKeys()) as string[];
        await db.submissionProjects.bulkDelete(ids);
        await db.submissions.bulkDelete(ids);
      });
    },
  };
}
