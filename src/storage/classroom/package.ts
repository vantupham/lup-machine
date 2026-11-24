import { z } from 'zod';
import { readZip, writeZip, ZipLimitError } from '@/core/project-file/zip';
import { decodeBundle, encodeBundle, ProjectFileError, type ProjectBundle } from '../project-file/bundle';
import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';
import { assignmentSchema, submissionSchema, type Assignment, type Submission } from '../schemas/assignment';
import { ClassroomFileError } from './errors';

/**
 * Gói bài tập (.lupa) và bài nộp (.lups): tệp zip gồm manifest.json, assignment.json / submission.json
 * và dự án (.lup) lồng bên trong. Tệp mở vào luôn được coi là KHÔNG TIN CẬY.
 */
export { ClassroomFileError };

export { ASSIGNMENT_FILE_EXTENSION, SUBMISSION_FILE_EXTENSION } from './extensions';

const FILES = { manifest: 'manifest.json', assignment: 'assignment.json', submission: 'submission.json', project: 'project.lup' } as const;
const JSON_MAX_BYTES = 1024 * 1024;

const FORMATS = { assignment: 'lup-assignment', submission: 'lup-submission' } as const;
type PackageKind = keyof typeof FORMATS;

const packageManifestSchema = z
  .object({
    format: z.enum([FORMATS.assignment, FORMATS.submission]),
    formatVersion: z.number().int().min(1).max(CURRENT_FORMAT_VERSION),
    appVersion: z.string().min(1).max(32),
    createdAt: z.iso.datetime(),
  })
  .strict();

/**
 * Dự án lồng bên trong gói nhỏ hơn giới hạn của tệp .lup thường: khi mở, tệp ngoài, bản sao dự án bên trong
 * và dữ liệu giải nén cùng nằm trong bộ nhớ, nên tổng phải vừa với máy phòng tin cấu hình thấp.
 */
export const NESTED_PROJECT_MAX_BYTES = 128 * 1024 * 1024;

export const CLASSROOM_FILE_LIMITS = {
  maxArchiveBytes: NESTED_PROJECT_MAX_BYTES + JSON_MAX_BYTES * 2,
  maxEntries: 10,
  maxTotalBytes: NESTED_PROJECT_MAX_BYTES + JSON_MAX_BYTES * 2,
};

/** Kiểm tra khi TẠO gói: không tạo ra tệp mà máy học sinh / giáo viên sẽ từ chối mở. */
function checkNestedSize(project: Uint8Array): Uint8Array {
  if (project.length > NESTED_PROJECT_MAX_BYTES) {
    throw new ClassroomFileError(`Dự án quá lớn để gửi kèm (tối đa ${NESTED_PROJECT_MAX_BYTES / 1024 / 1024} MB)`);
  }
  return project;
}

export interface PackageMeta {
  readonly appVersion: string;
  readonly createdAt: string;
}

export interface AssignmentPackage {
  readonly assignment: Assignment;
  /** Dự án mẫu giáo viên chuẩn bị sẵn (null: học sinh bắt đầu từ dự án trống). */
  readonly starter: ProjectBundle | null;
}

export interface SubmissionPackage {
  readonly submission: Submission;
  readonly project: ProjectBundle;
}

const encoder = new TextEncoder();
const json = (value: unknown) => encoder.encode(JSON.stringify(value));

function writePackage(kind: PackageKind, meta: PackageMeta, body: Record<string, Uint8Array>): Uint8Array {
  const manifest = { format: FORMATS[kind], formatVersion: CURRENT_FORMAT_VERSION, appVersion: meta.appVersion, createdAt: meta.createdAt };
  return writeZip({ [FILES.manifest]: json(manifest), ...body });
}

export function encodeAssignmentPackage(pkg: AssignmentPackage, meta: PackageMeta): Uint8Array {
  return writePackage('assignment', meta, {
    [FILES.assignment]: json(pkg.assignment),
    ...(pkg.starter ? { [FILES.project]: checkNestedSize(encodeBundle(pkg.starter)) } : {}),
  });
}

export function encodeSubmissionPackage(pkg: SubmissionPackage, meta: PackageMeta): Uint8Array {
  return writePackage('submission', meta, { [FILES.submission]: json(pkg.submission), [FILES.project]: checkNestedSize(encodeBundle(pkg.project)) });
}

function acceptEntry(name: string): number | false {
  if (name === FILES.project) return NESTED_PROJECT_MAX_BYTES;
  if (name === FILES.manifest || name === FILES.assignment || name === FILES.submission) return JSON_MAX_BYTES;
  return false;
}

function openPackage(bytes: Uint8Array, kind: PackageKind): Map<string, Uint8Array> {
  let files: Map<string, Uint8Array>;
  try {
    files = readZip(bytes, CLASSROOM_FILE_LIMITS, acceptEntry);
  } catch (error: unknown) {
    if (error instanceof ZipLimitError) throw new ClassroomFileError(error.message);
    throw new ClassroomFileError('Không đọc được tệp: tệp hỏng hoặc không phải tệp của LUP Machine', { cause: error });
  }
  const manifest = readJson(files, FILES.manifest, z.unknown());
  const format = (manifest as { format?: unknown } | null)?.format;
  if (format !== FORMATS[kind]) {
    throw new ClassroomFileError(kind === 'assignment' ? 'Đây không phải gói bài tập (.lupa)' : 'Đây không phải bài nộp (.lups)');
  }
  const parsed = packageManifestSchema.safeParse(manifest);
  if (!parsed.success) throw new ClassroomFileError(`${FILES.manifest}: ${parsed.error.issues[0]?.message ?? 'không hợp lệ'}`);
  return files;
}

function readJson<T>(files: Map<string, Uint8Array>, name: string, schema: z.ZodType<T>): T | null {
  const data = files.get(name);
  if (!data) return null;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  } catch {
    throw new ClassroomFileError(`${name}: JSON không hợp lệ`);
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ClassroomFileError(`${name}: ${issue?.path.join('.') || '(gốc)'} ${issue?.message ?? 'không hợp lệ'}`);
  }
  return result.data;
}

function requireJson<T>(files: Map<string, Uint8Array>, name: string, schema: z.ZodType<T>): T {
  const value = readJson(files, name, schema);
  if (value === null) throw new ClassroomFileError(`Thiếu tệp ${name}`);
  return value;
}

function decodeProject(data: Uint8Array, expectedType: Assignment['projectType']): ProjectBundle {
  let bundle: ProjectBundle;
  try {
    bundle = decodeBundle(data);
  } catch (error: unknown) {
    if (error instanceof ProjectFileError) throw new ClassroomFileError(`${FILES.project}: ${error.message}`);
    throw error;
  }
  if (bundle.manifest.projectType !== expectedType) throw new ClassroomFileError('Dự án bên trong không đúng loại dự án của bài tập');
  return bundle;
}

export function decodeAssignmentPackage(bytes: Uint8Array): AssignmentPackage {
  const files = openPackage(bytes, 'assignment');
  const assignment = requireJson(files, FILES.assignment, assignmentSchema);
  const project = files.get(FILES.project);
  return { assignment, starter: project ? decodeProject(project, assignment.projectType) : null };
}

export function decodeSubmissionPackage(bytes: Uint8Array): SubmissionPackage {
  const files = openPackage(bytes, 'submission');
  const submission = requireJson(files, FILES.submission, submissionSchema);
  if (submission.answers.length !== submission.assignment.questions.length) {
    throw new ClassroomFileError('Số câu trả lời không khớp số câu hỏi của bài tập');
  }
  const project = files.get(FILES.project);
  if (!project) throw new ClassroomFileError(`Thiếu tệp ${FILES.project}`);
  return { submission, project: decodeProject(project, submission.assignment.projectType) };
}
