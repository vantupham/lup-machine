/** Tải một tệp văn bản về máy (tạo ngay trong trình duyệt, không qua máy chủ). */
export function downloadText(fileName: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // để trình duyệt kịp bắt đầu tải trước khi thu hồi URL
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
