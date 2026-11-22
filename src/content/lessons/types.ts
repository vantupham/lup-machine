import type { AnyDatasetId } from '@/core/datasets/catalog';

export interface PredictPrompt {
  readonly question: string;
  readonly answer: string;
}

/**
 * Khung ghi kết quả trên phiếu bài tập in (học sinh điền tay).
 * Trường "answers"/"answer" (tùy chọn) là SỐ LIỆU MẪU cho bản giáo viên, lấy từ lần chạy kiểm chứng
 * với MobileNet thật — được kiểm tra tính nhất quán (kiểm thử đơn vị) và đối chiếu lần chạy thật (E2E).
 */
export type WorksheetRecord =
  /** Các ô điền ngắn, ví dụ "Điểm Kiểm tra: ……%". */
  | { readonly kind: 'fields'; readonly title: string; readonly fields: readonly string[]; readonly answers?: readonly string[] }
  /** Bảng: cột đầu là nhãn hàng, các cột sau để trống. answers[hàng][cột sau cột nhãn]. */
  | {
      readonly kind: 'table';
      readonly title: string;
      readonly columns: readonly string[];
      readonly rows: readonly string[];
      readonly answers?: readonly (readonly string[])[];
    }
  /** Ma trận nhầm lẫn trống, tên lớp lấy từ bộ dữ liệu của bài. answers[thật][đoán] = số ảnh. */
  | { readonly kind: 'confusion'; readonly title: string; readonly answers?: readonly (readonly number[])[] }
  /** Vài dòng kẻ để viết nhận xét. answer = gợi ý cho giáo viên. */
  | { readonly kind: 'lines'; readonly title: string; readonly lines: number; readonly answer?: string };

export interface LessonStep {
  readonly title: string;
  readonly body: readonly string[];
  readonly predict?: PredictPrompt;
  /** Khung ghi kết quả của bước này trên phiếu bài tập. */
  readonly record?: readonly WorksheetRecord[];
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
  readonly dataset: AnyDatasetId;
  readonly goals: readonly string[];
  readonly steps: readonly LessonStep[];
  readonly quiz: readonly QuizQuestion[];
  readonly wrapUp: string;
  readonly teacherNotes: readonly string[];
}
