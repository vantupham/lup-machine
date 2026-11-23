/** Tải một Blob về máy (tạo ngay trong trình duyệt, không qua máy chủ). */
function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
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

/** Tải một tệp văn bản về máy. */
export function downloadText(fileName: string, text: string, mime = 'application/json'): void {
  downloadBlob(fileName, new Blob([text], { type: `${mime};charset=utf-8` }));
}

/** Tải một tệp nhị phân (ví dụ tệp dự án .lup) về máy. */
export function downloadBytes(fileName: string, bytes: Uint8Array, mime = 'application/zip'): void {
  downloadBlob(fileName, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
}
