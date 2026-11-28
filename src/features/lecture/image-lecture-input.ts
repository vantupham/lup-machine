import type { ScoredItem } from '@/core/ml/findings';
import type { ClassPairBackground, DuplicatePair } from '@/core/data/deep-checks';
import type { ClassRecord, RunRecord, SampleRecord } from '@/storage/db';
import type { ModelCardFields } from '@/storage/schemas/model-card';
import type { SamplePrediction } from '@/features/studio/image/lab/lab-data';
import type { ImageLectureInput } from './build-image-script';
import type { LectureLevel } from './lecture-script';

/** Mô hình đang mở trong trang (ImageLab): chỉ dùng dự đoán khi đúng là lần chạy mới nhất, ở epoch cuối. */
export interface CurrentModel {
  readonly runNumber: number | null;
  /** Dấu vân tay dữ liệu HIỆN TẠI (lớp + ảnh + tập): khác lần chạy thì dự đoán không còn khớp nhật ký. */
  readonly fingerprint: string;
  readonly isStale: boolean;
  readonly isTraining: boolean;
  readonly isFinalEpoch: boolean;
  readonly predictions: ReadonlyMap<string, SamplePrediction>;
}

export interface DeepCheckSummary {
  readonly duplicates: readonly DuplicatePair[];
  readonly backgrounds: readonly ClassPairBackground[];
}

export interface ImageLectureSources {
  readonly projectName: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  /** Nhật ký như repository trả về: lần MỚI NHẤT trước. */
  readonly runs: readonly RunRecord[];
  readonly current: CurrentModel;
  /** null: chưa soi xong. */
  readonly deepCheck: DeepCheckSummary | null;
  readonly modelCard: ModelCardFields | null;
  readonly level: LectureLevel;
  readonly includeStudentWriting: boolean;
}

/** Dự đoán trên tập Kiểm tra của mô hình đang mở, nếu nó khớp lần chạy mới nhất trong nhật ký. */
export function testEvaluation(sources: Pick<ImageLectureSources, 'samples' | 'runs' | 'current'>): { readonly items: readonly ScoredItem[] } | null {
  const { current } = sources;
  const latest = sources.runs[0];
  // Chạy lại / khôi phục một lần cũ sau khi đã sửa dữ liệu thì isStale vẫn false: so thêm dấu vân tay.
  if (!latest || latest.fingerprint !== current.fingerprint) return null;
  if (current.runNumber !== latest.number || current.isStale || current.isTraining || !current.isFinalEpoch) return null;
  const items: ScoredItem[] = [];
  for (const sample of sources.samples) {
    if (sample.split !== 'test') continue;
    const p = current.predictions.get(sample.id);
    if (p) items.push({ id: sample.id, actual: p.actual, predicted: p.predicted, confidence: p.probabilities[p.predicted] ?? 0 });
  }
  return items.length > 0 ? { items } : null;
}

function summarizeDeepCheck(check: DeepCheckSummary | null, classNames: readonly string[]): ImageLectureInput['dataChecks'] {
  if (!check) return null;
  const shortcut = check.backgrounds.filter((b) => b.isShortcut).sort((x, y) => y.accuracy - x.accuracy)[0];
  return {
    leakPairs: check.duplicates.filter((p) => p.isLeak).length,
    sameSplitPairs: check.duplicates.filter((p) => !p.isLeak).length,
    shortcut: shortcut ? { a: classNames[shortcut.a] ?? '', b: classNames[shortcut.b] ?? '', accuracy: shortcut.accuracy } : null,
  };
}

/** Gom dữ liệu đang có trong trang dự án ảnh thành đầu vào cho kịch bản bài giảng. */
export function imageLectureInput(sources: ImageLectureSources): ImageLectureInput {
  const classNames = sources.classes.map((c) => c.name);
  const count = (classId: string, split: 'train' | 'test') => sources.samples.filter((s) => s.classId === classId && s.split === split).length;
  const counts = sources.classes.map((c) => ({ train: count(c.id, 'train'), test: count(c.id, 'test') }));
  return {
    projectName: sources.projectName,
    classNames,
    counts,
    runs: [...sources.runs].reverse(),
    evaluation: testEvaluation(sources),
    dataChecks: summarizeDeepCheck(sources.deepCheck, classNames),
    modelCard: sources.modelCard,
    level: sources.level,
    includeStudentWriting: sources.includeStudentWriting,
  };
}
