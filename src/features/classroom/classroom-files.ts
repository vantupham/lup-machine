import { version as APP_VERSION } from '../../../package.json';
import { fileSlug } from '@/core/file-name';
import type { ProjectRecord } from '@/storage/db';
import type { Repositories } from '@/storage/repository-context';
import type { ProjectBundle } from '@/storage/project-file/bundle';
import { CURRENT_FORMAT_VERSION } from '@/storage/schemas/manifest';
import type { ProjectType } from '@/storage/schemas/project';
import { isModelCardComplete } from '@/storage/schemas/model-card';
import {
  assignmentSchema,
  factsSummarySchema,
  submitterSchema,
  type AssignmentDraft,
  type Submission,
  type Submitter,
} from '@/storage/schemas/assignment';
import { loadModelCardFacts } from '@/features/model-card/facts';

export type ClassroomRepositories = Pick<
  Repositories,
  'projects' | 'projectFiles' | 'modelCards' | 'assignments' | 'dataset' | 'audio' | 'poses' | 'tables' | 'experiments'
>;

export interface ClassroomDeps {
  readonly now: () => string;
  readonly newId: () => string;
}

const defaultDeps: ClassroomDeps = { now: () => new Date().toISOString(), newId: () => crypto.randomUUID() };

export interface ClassroomFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Lý do chưa nộp được bài (hiện cho học sinh kèm cách sửa). */
export type SubmissionBlocker = 'students' | 'model-card' | 'answers' | 'unsaved-answers';

export class SubmissionBlockedError extends Error {
  constructor(readonly blockers: readonly SubmissionBlocker[]) {
    super(`Chưa nộp được bài: ${blockers.join(', ')}`);
  }
}

// Thư viện zip chỉ tải khi cần.
const loadPackage = () => import('@/storage/classroom/package');

/** Dự án mẫu gửi cho học sinh không kèm thẻ mô hình của giáo viên (học sinh tự viết). */
function asStarter(bundle: ProjectBundle, title: string): ProjectBundle {
  return { ...bundle, manifest: { ...bundle.manifest, name: title }, modelCard: null, notes: [], trials: [] };
}

export async function createAssignmentFile(
  repos: ClassroomRepositories,
  draft: AssignmentDraft,
  starterProjectId: string | null,
  deps: ClassroomDeps = defaultDeps,
): Promise<ClassroomFile> {
  const assignment = assignmentSchema.parse({ ...draft, id: deps.newId(), createdAt: deps.now() });
  const starterBundle = starterProjectId ? await repos.projectFiles.readBundle(starterProjectId) : null;
  if (starterBundle && starterBundle.manifest.projectType !== assignment.projectType) {
    throw new Error('Dự án mẫu không đúng loại dự án của bài tập');
  }
  const starter = starterBundle ? asStarter(starterBundle, assignment.title) : null;
  const { encodeAssignmentPackage, ASSIGNMENT_FILE_EXTENSION } = await loadPackage();
  const bytes = encodeAssignmentPackage({ assignment, starter }, { appVersion: APP_VERSION, createdAt: assignment.createdAt });
  return { fileName: `${fileSlug(assignment.title)}${ASSIGNMENT_FILE_EXTENSION}`, bytes };
}

function emptyBundle(type: ProjectType, name: string, classes: readonly string[], createdAt: string): ProjectBundle {
  return {
    manifest: { formatVersion: CURRENT_FORMAT_VERSION, appVersion: APP_VERSION, projectType: type, name, createdAt },
    classes,
    images: [],
    clips: [],
    poses: [],
    table: null,
    runs: [],
    modelCard: null,
    notes: [],
    trials: [],
  };
}

/**
 * Học sinh mở gói bài tập: tạo dự án mới (từ dự án mẫu, hoặc dự án trống cùng loại) gắn với bài tập.
 * `defaultImageClasses`: tên 2 lớp mặc định cho dự án ảnh trống (theo ngôn ngữ giao diện).
 */
export async function openAssignmentFile(
  repos: ClassroomRepositories,
  bytes: Uint8Array,
  defaultImageClasses: readonly string[],
  deps: ClassroomDeps = defaultDeps,
): Promise<ProjectRecord> {
  const { decodeAssignmentPackage } = await loadPackage();
  const { assignment, starter } = decodeAssignmentPackage(bytes);
  const classes = assignment.projectType === 'image' ? defaultImageClasses : [];
  const bundle = starter ? asStarter(starter, assignment.title) : emptyBundle(assignment.projectType, assignment.title, classes, deps.now());
  return repos.projectFiles.writeBundle(bundle, { assignment });
}

/** Điều kiện kiểm tra ngay trên ô nhập (không cần đọc cơ sở dữ liệu). */
export function submitterBlockers(submitter: Submitter): SubmissionBlocker[] {
  return submitterSchema.safeParse(submitter).success ? [] : ['students'];
}

/** Điều kiện phụ thuộc dữ liệu đã lưu: thẻ mô hình và câu trả lời. */
export async function storedBlockers(repos: ClassroomRepositories, projectId: string): Promise<SubmissionBlocker[]> {
  const [linked, card] = await Promise.all([repos.assignments.get(projectId), repos.modelCards.get(projectId)]);
  const blockers: SubmissionBlocker[] = [];
  if (!isModelCardComplete(card)) blockers.push('model-card');
  if (!linked || linked.answers.some((a) => a.trim() === '')) blockers.push('answers');
  return blockers;
}

export async function submissionBlockers(repos: ClassroomRepositories, projectId: string, submitter: Submitter): Promise<SubmissionBlocker[]> {
  return [...submitterBlockers(submitter), ...(await storedBlockers(repos, projectId))];
}

/** Bỏ dữ liệu gốc (ảnh, âm thanh, tư thế, bảng): chỉ còn lớp, nhật ký và thẻ mô hình. */
function withoutRawData(bundle: ProjectBundle): ProjectBundle {
  return {
    ...bundle,
    images: [],
    clips: [],
    poses: [],
    table: null,
    // Không còn dữ liệu nên không lần chạy nào "chạy lại được" sau khi mở.
    runs: bundle.runs.map((run) => ({ ...run, matchesData: false })),
  };
}

export async function createSubmissionFile(
  repos: ClassroomRepositories,
  projectId: string,
  submitter: Submitter,
  includeData: boolean,
  deps: ClassroomDeps = defaultDeps,
): Promise<ClassroomFile> {
  const blockers = await submissionBlockers(repos, projectId, submitter);
  if (blockers.length > 0) throw new SubmissionBlockedError(blockers);
  const linked = await repos.assignments.get(projectId);
  const project = await repos.projects.findById(projectId);
  if (!linked || !project) throw new Error('Không tìm thấy bài tập của dự án này');

  const bundle = await repos.projectFiles.readBundle(projectId);
  const facts = factsSummarySchema.parse(await loadModelCardFacts(repos, project));
  // Không kèm dữ liệu thì giáo viên không chạy lại được lần huấn luyện nào: số liệu phải nói đúng như vậy.
  const summary = includeData || !facts.latestRun ? facts : { ...facts, latestRun: { ...facts.latestRun, matchesData: false } };
  const submission: Submission = {
    assignment: linked.assignment,
    submitter: submitterSchema.parse(submitter),
    answers: [...linked.answers],
    submittedAt: deps.now(),
    includesData: includeData,
    summary,
  };
  const { encodeSubmissionPackage, SUBMISSION_FILE_EXTENSION } = await loadPackage();
  const bytes = encodeSubmissionPackage(
    { submission, project: includeData ? bundle : withoutRawData(bundle) },
    { appVersion: APP_VERSION, createdAt: submission.submittedAt },
  );
  const fileName = `${fileSlug(linked.assignment.title)}-${fileSlug(submission.submitter.students)}${SUBMISSION_FILE_EXTENSION}`;
  return { fileName, bytes };
}
