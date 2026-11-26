import type { ClassRecord, SampleRecord } from '@/storage/db';

/**
 * Hành động "cải tiến" ngay từ chỗ thấy lỗi (ô ma trận nhầm lẫn): thêm ảnh Huấn luyện cho lớp
 * bị nhận sai, hoặc bỏ ảnh lỗi. Trang dự án cung cấp vì nó giữ hộp webcam và việc tải ảnh.
 */
export interface ImproveActions {
  /** Mở hộp webcam để chụp thêm ảnh Huấn luyện cho lớp này. */
  readonly capture: (cls: ClassRecord) => void;
  /** Thêm các tệp ảnh vào ngăn Huấn luyện của lớp này. */
  readonly upload: (cls: ClassRecord, files: File[]) => void;
  /** Xóa một ảnh khỏi dự án (hỏi lại trước khi xóa). */
  readonly deleteSample: (sample: SampleRecord) => void;
}
