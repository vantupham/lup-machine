import Dexie, { type EntityTable } from 'dexie';
import type { ProjectType } from './schemas/project';
import type { Submission } from './schemas/assignment';
import type { Grade } from './schemas/grade';
import type { ProjectBundle } from './project-file/bundle';
import type { ModelCardFields } from './schemas/model-card';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly projectType: ProjectType;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClassRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly order: number;
  readonly createdAt: string;
}

export type Split = 'train' | 'test';
export type SampleSource = 'upload' | 'webcam' | 'dataset';

/** Ảnh đã chuẩn hóa về 224×224 — chính là ảnh mô hình nhận được. */
export interface StoredImage {
  readonly bytes: ArrayBuffer;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
}

/** Ghi công cho ảnh lấy từ bộ dữ liệu có giấy phép mở (bắt buộc theo CC BY / MIT). */
export interface ImageCredit {
  readonly author: string;
  readonly source: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export interface SampleRecord {
  readonly id: string;
  readonly projectId: string;
  readonly classId: string;
  readonly split: Split;
  readonly source: SampleSource;
  readonly image: StoredImage;
  readonly createdAt: string;
  /** Thứ tự trong lô thêm vào. Giữ thứ tự ổn định khi nhiều ảnh cùng createdAt (dữ liệu cũ có thể thiếu). */
  readonly seq?: number;
  /** Chỉ có ở ảnh từ bộ dữ liệu ảnh thật: tác giả, nguồn, giấy phép. */
  readonly credit?: ImageCredit;
}

/** Vector đặc trưng đã trích (cache): mỗi ảnh chỉ trích một lần cho mỗi mô hình. */
export interface FeatureRecord {
  readonly sampleId: string;
  readonly modelId: string;
  readonly projectId: string;
  readonly vector: ArrayBuffer;
}

export interface EpochMetrics {
  readonly epoch: number;
  readonly trainLoss: number;
  readonly trainAccuracy: number;
  readonly testLoss: number | null;
  readonly testAccuracy: number | null;
}

/** Một lần huấn luyện trong nhật ký thí nghiệm. Không lưu trọng số: chạy lại với cùng seed sẽ ra đúng kết quả. */
export interface RunRecord {
  readonly id: string;
  readonly projectId: string;
  readonly number: number;
  readonly createdAt: string;
  readonly fingerprint: string;
  readonly options: { readonly epochs: number; readonly learningRate: number; readonly batchSize: number; readonly seed: number };
  readonly classNames: readonly string[];
  readonly counts: { readonly train: number; readonly test: number };
  readonly metrics: readonly EpochMetrics[];
  /** Điểm Kiểm tra học sinh đoán trước khi huấn luyện (0–1), nếu có đoán. */
  readonly guess?: { readonly testAccuracy: number } | undefined;
}

/** Ghi chép của học sinh ở một bước của dự án (sổ tay khám phá). */
export interface NoteRecord {
  readonly projectId: string;
  readonly step: string;
  readonly text: string;
  readonly updatedAt: string;
}

/** Bảng dữ liệu của dự án loại "Dữ liệu bảng": CSV gốc + cấu hình (đã kiểm tra bằng zod khi đọc). */
export interface TableRecord {
  readonly projectId: string;
  readonly csv: string;
  readonly fileName: string;
  readonly sampleId: string | null;
  readonly config: unknown;
  readonly updatedAt: string;
}

export type AudioSource = 'microphone' | 'upload' | 'dataset';

/** Một đoạn âm thanh đã chuẩn hóa: đúng 1 giây, 16 kHz, số thực 32 bit (64 KB). Không lưu tệp gốc. */
export interface AudioClipRecord {
  readonly id: string;
  readonly projectId: string;
  readonly classId: string;
  readonly source: AudioSource;
  readonly pcm: ArrayBuffer;
  readonly createdAt: string;
  readonly seq: number;
}

export type PoseSource = 'webcam' | 'upload' | 'dataset';

/** Một mẫu tư thế: CHỈ tọa độ các khớp (không lưu ảnh), dạng [x0, y0, độ tin cậy 0, x1, …] theo pixel của khung hình. */
export interface PoseSampleRecord {
  readonly id: string;
  readonly projectId: string;
  readonly classId: string;
  readonly kind: 'body' | 'hand';
  readonly source: PoseSource;
  readonly keypoints: readonly number[];
  readonly width: number;
  readonly height: number;
  readonly createdAt: string;
  readonly seq: number;
}

/** Thẻ mô hình của một dự án; `fields` được kiểm tra bằng zod khi đọc. */
export interface ModelCardRecord {
  readonly projectId: string;
  readonly fields: unknown;
  readonly updatedAt: string;
}

/** Bài tập (gói .lupa) gắn với một dự án và câu trả lời của học sinh; kiểm tra bằng zod khi đọc. */
export interface AssignmentRecord {
  readonly projectId: string;
  readonly assignment: unknown;
  readonly answers: unknown;
  readonly updatedAt: string;
}

/**
 * Bài nộp giáo viên đã nhận. Nội dung đã được kiểm tra đầy đủ khi mở tệp .lups
 * (dữ liệu do chính ứng dụng ghi vào), nên lưu ở dạng có kiểu.
 */
export interface SubmissionRecord {
  readonly id: string;
  readonly assignmentId: string;
  /** Họ tên + lớp đã chuẩn hóa: tìm bài nộp lại của cùng học sinh bằng chỉ mục, không quét cả lớp. */
  readonly studentKey: string;
  readonly fileName: string;
  readonly receivedAt: string;
  readonly submission: Submission;
  /** Thẻ mô hình chép ra từ dự án để xem nhanh mà không phải đọc cả dự án. */
  readonly modelCard: ModelCardFields | null;
  readonly grade: Grade;
}

/** Dự án đầy đủ của một bài nộp (có thể kèm nhiều ảnh): bảng riêng, chỉ đọc khi giáo viên mở. */
export interface SubmissionProjectRecord {
  readonly id: string;
  readonly project: ProjectBundle;
}

export const DEFAULT_DB_NAME = 'lup-machine';

/** Cơ sở dữ liệu IndexedDB cục bộ. Dữ liệu chỉ nằm trên máy người dùng. */
export class LupDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  classes!: EntityTable<ClassRecord, 'id'>;
  samples!: EntityTable<SampleRecord, 'id'>;
  features!: Dexie.Table<FeatureRecord, [string, string]>;
  runs!: EntityTable<RunRecord, 'id'>;
  dataTables!: EntityTable<TableRecord, 'projectId'>;
  audioClips!: EntityTable<AudioClipRecord, 'id'>;
  poseSamples!: EntityTable<PoseSampleRecord, 'id'>;
  modelCards!: EntityTable<ModelCardRecord, 'projectId'>;
  assignments!: EntityTable<AssignmentRecord, 'projectId'>;
  submissions!: EntityTable<SubmissionRecord, 'id'>;
  submissionProjects!: EntityTable<SubmissionProjectRecord, 'id'>;
  notes!: Dexie.Table<NoteRecord, [string, string]>;

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
    });
    this.version(2).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
    });
    this.version(3).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
    });
    this.version(4).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
    });
    this.version(5).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
    });
    this.version(6).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
    });
    this.version(7).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
      poseSamples: 'id, projectId, classId',
    });
    this.version(8).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
      poseSamples: 'id, projectId, classId',
      modelCards: 'projectId',
    });
    this.version(9).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
      poseSamples: 'id, projectId, classId',
      modelCards: 'projectId',
      assignments: 'projectId',
    });
    this.version(10).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
      poseSamples: 'id, projectId, classId',
      modelCards: 'projectId',
      assignments: 'projectId',
      submissions: 'id, assignmentId, [assignmentId+studentKey]',
      submissionProjects: 'id',
    });
    this.version(11).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
      poseSamples: 'id, projectId, classId',
      modelCards: 'projectId',
      assignments: 'projectId',
      submissions: 'id, assignmentId, [assignmentId+studentKey]',
      submissionProjects: 'id',
      notes: '[projectId+step], projectId',
    });
  }
}
