// Chạy đồng bộ trong <head>, trước khi vẽ trang: áp giao diện tối đã chọn để không nháy nền sáng.
// Giữ đồng bộ khóa 'lup.theme' với src/ui/theme-store.ts. localStorage có thể bị chặn → giữ mặc định sáng.
try {
  if (window.localStorage.getItem('lup.theme') === 'dark') document.documentElement.dataset.theme = 'dark';
} catch {
  // Bỏ qua có chủ đích: không đọc được lựa chọn thì dùng giao diện sáng mặc định.
}
