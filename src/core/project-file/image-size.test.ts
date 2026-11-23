import { imageDimensions } from './image-size';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number, sof = 0xc0): Uint8Array {
  // SOI, APP0 (độ dài 4: 2 byte dữ liệu rác), SOFn với chiều cao rồi chiều rộng
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, sof, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0];
  return new Uint8Array(bytes);
}

describe('imageDimensions', () => {
  test('đọc kích thước PNG từ khối IHDR', () => {
    expect(imageDimensions(png(224, 200), 'image/png')).toEqual({ width: 224, height: 200 });
  });

  test('đọc kích thước JPEG từ khối SOF, bỏ qua khối APP phía trước', () => {
    expect(imageDimensions(jpeg(224, 224), 'image/jpeg')).toEqual({ width: 224, height: 224 });
    expect(imageDimensions(jpeg(640, 480, 0xc2), 'image/jpeg')).toEqual({ width: 640, height: 480 });
  });

  test('không nhầm khối DHT (C4) với SOF', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xc4, 0, 4, 9, 9, ...jpeg(100, 50).subarray(8)]);
    expect(imageDimensions(bytes, 'image/jpeg')).toEqual({ width: 100, height: 50 });
  });

  test('ảnh hỏng hoặc cắt cụt thì trả về null', () => {
    expect(imageDimensions(png(1, 1).subarray(0, 20), 'image/png')).toBeNull();
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 200]), 'image/jpeg')).toBeNull();
    expect(imageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'image/jpeg')).toBeNull();
    expect(imageDimensions(new Uint8Array([1, 2, 3]), 'image/png')).toBeNull();
  });
});
