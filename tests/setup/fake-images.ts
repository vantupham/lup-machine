/** Phần đầu tệp JPEG tối thiểu (SOI + SOF0) có kích thước thật, đủ cho các bước kiểm tra tệp .lup. */
export function fakeJpeg(tag = 0, width = 224, height = 224): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0, 0xff, 0xd9, tag]);
}

/** Phần đầu tệp PNG tối thiểu (chữ ký + IHDR). */
export function fakePng(width = 224, height = 224): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** Ảnh lưu trong IndexedDB dựng từ ảnh JPEG giả 224×224; `tag` là byte cuối để phân biệt các ảnh. */
export function fakeStoredJpeg(tag = 0) {
  return { bytes: fakeJpeg(tag).buffer as ArrayBuffer, mime: 'image/jpeg', width: 224, height: 224 };
}
