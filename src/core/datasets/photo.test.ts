import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHOTO_DATASETS, parsePhotoManifest, type PhotoDatasetId } from './photo';

const credit = { author: 'A', source: 'https://www.flickr.com/photos/x/1/', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' };

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'flowers-3',
    version: 1,
    size: 224,
    changes: 'Cắt vuông giữa',
    classes: ['daisy', 'sunflower', 'rose'],
    images: [
      { file: 'daisy/01.jpg', class: 'daisy', split: 'train', original: 'daisy/a.jpg', credit },
      { file: 'daisy/02.jpg', class: 'daisy', split: 'test', original: 'daisy/b.jpg', credit },
      { file: 'rose/01.jpg', class: 'rose', split: 'train', original: 'roses/c.jpg', credit },
    ],
    ...overrides,
  };
}

describe('parsePhotoManifest', () => {
  test('đọc manifest hợp lệ', () => {
    const m = parsePhotoManifest(manifest(), 'flowers-3');
    expect(m.images).toHaveLength(3);
    expect(m.images[0]!.credit.author).toBe('A');
  });

  test('từ chối manifest của bộ khác hoặc lớp không khớp định nghĩa', () => {
    expect(() => parsePhotoManifest(manifest(), 'beans-3')).toThrow(/beans-3/);
    expect(() => parsePhotoManifest(manifest({ classes: ['daisy', 'rose'] }), 'flowers-3')).toThrow(/lớp/);
  });

  test('chỉ chấp nhận đường dẫn ảnh dạng "lớp/NN.jpg" (chặn ../, đường dẫn tuyệt đối, URL)', () => {
    for (const file of ['../secret.jpg', '/daisy/01.jpg', 'https://evil.example/x.jpg', 'daisy/01.png', 'daisy/../01.jpg']) {
      const bad = manifest({ images: [{ file, class: 'daisy', split: 'train', original: 'x', credit }] });
      expect(() => parsePhotoManifest(bad, 'flowers-3')).toThrow();
    }
  });

  test('từ chối ảnh thuộc lớp không khai báo, thư mục không khớp lớp, hoặc trùng tệp', () => {
    expect(() => parsePhotoManifest(manifest({ images: [{ file: 'tulip/01.jpg', class: 'tulip', split: 'train', original: 'x', credit }] }), 'flowers-3')).toThrow();
    expect(() => parsePhotoManifest(manifest({ images: [{ file: 'rose/01.jpg', class: 'daisy', split: 'train', original: 'x', credit }] }), 'flowers-3')).toThrow(/thư mục/);
    const dup = { file: 'daisy/01.jpg', class: 'daisy', split: 'train', original: 'x', credit };
    expect(() => parsePhotoManifest(manifest({ images: [dup, dup] }), 'flowers-3')).toThrow(/trùng/);
  });

  test('bắt buộc ghi nguồn: thiếu tác giả hoặc giấy phép thì từ chối', () => {
    const noAuthor = manifest({ images: [{ file: 'daisy/01.jpg', class: 'daisy', split: 'train', original: 'x', credit: { ...credit, author: '' } }] });
    expect(() => parsePhotoManifest(noAuthor, 'flowers-3')).toThrow();
    const badUrl = manifest({ images: [{ file: 'daisy/01.jpg', class: 'daisy', split: 'train', original: 'x', credit: { ...credit, source: 'javascript:alert(1)' } }] });
    expect(() => parsePhotoManifest(badUrl, 'flowers-3')).toThrow();
  });
});

describe('Các bộ ảnh thật trong public/datasets khớp định nghĩa', () => {
  test.each(PHOTO_DATASETS.map((d) => [d.id] as [PhotoDatasetId]))('%s: manifest hợp lệ, đủ ảnh mỗi lớp, mọi tệp tồn tại, ghi nguồn đầy đủ', (id) => {
    const def = PHOTO_DATASETS.find((d) => d.id === id)!;
    const dir = join(process.cwd(), 'public', 'datasets', id);
    const m = parsePhotoManifest(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), id);
    for (const key of def.classKeys) {
      const ofClass = m.images.filter((im) => im.class === key);
      expect(ofClass.filter((im) => im.split === 'train')).toHaveLength(def.trainPerClass);
      expect(ofClass.filter((im) => im.split === 'test')).toHaveLength(def.testPerClass);
    }
    for (const im of m.images) {
      const bytes = readFileSync(join(dir, im.file));
      expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]); // JPEG
    }
  });
});
