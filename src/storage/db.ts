import Dexie, { type EntityTable } from 'dexie';
import type { ProjectType } from './schemas/project';

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
  }
}
