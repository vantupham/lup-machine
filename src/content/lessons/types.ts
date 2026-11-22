import type { PhotoDatasetId } from '@/core/datasets/photo';
import type { SampleDatasetId } from '@/core/datasets/synthetic';

export interface PredictPrompt {
  readonly question: string;
  readonly answer: string;
}

export interface LessonStep {
  readonly title: string;
  readonly body: readonly string[];
  readonly predict?: PredictPrompt;
}

export interface QuizQuestion {
  readonly question: string;
  readonly options: readonly string[];
  readonly correct: number;
  readonly explanation: string;
}

/** Bài học (nội dung tiếng Việt, giấy phép CC BY 4.0). */
export interface Lesson {
  readonly id: string;
  readonly grade: string;
  readonly minutes: number;
  readonly title: string;
  readonly summary: string;
  /** Bộ dữ liệu mẫu dùng cho bài: hình vẽ tổng hợp hoặc ảnh thật có giấy phép mở. */
  readonly dataset: SampleDatasetId | PhotoDatasetId;
  readonly goals: readonly string[];
  readonly steps: readonly LessonStep[];
  readonly quiz: readonly QuizQuestion[];
  readonly wrapUp: string;
  readonly teacherNotes: readonly string[];
}
