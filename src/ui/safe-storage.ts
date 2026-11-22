/**
 * localStorage có thể ném lỗi (chế độ ẩn danh, bị chặn lưu trữ).
 * Chỉ dùng cho tiện ích nhỏ (ngôn ngữ, chế độ học); trang vẫn chạy đúng khi không có.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Bỏ qua có chủ đích: đây chỉ là ghi nhớ tùy chọn, không phải dữ liệu quan trọng.
    }
  },
};
