import { strToU8, unzipSync, zipSync } from 'fflate';
import { decodeBundle, encodeBundle, ProjectFileError, type ProjectBundle } from './bundle';
import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';

import { fakeJpeg, fakePng } from '../../../tests/setup/fake-images';

const JPEG = fakeJpeg(1);
const PNG = fakePng();

function manifest(projectType: ProjectBundle['manifest']['projectType']): ProjectBundle['manifest'] {
  return { formatVersion: CURRENT_FORMAT_VERSION, appVersion: '0.1.0', projectType, name: 'Dự án thử', createdAt: '2026-11-23T08:00:00.000Z' };
}

function empty(projectType: ProjectBundle['manifest']['projectType']): ProjectBundle {
  return { manifest: manifest(projectType), classes: [], images: [], clips: [], poses: [], table: null, runs: [], modelCard: null, notes: [] };
}

const credit = { author: 'A. Tác giả', source: 'https://example.org/a', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' };

const imageBundle: ProjectBundle = {
  ...empty('image'),
  classes: ['Mèo', 'Chó'],
  images: [
    { classIndex: 0, split: 'train', source: 'upload', image: { bytes: JPEG.slice().buffer, mime: 'image/jpeg', width: 224, height: 224 } },
    { classIndex: 1, split: 'test', source: 'dataset', image: { bytes: PNG.slice().buffer, mime: 'image/png', width: 224, height: 224 }, credit },
  ],
  runs: [
    {
      number: 1,
      createdAt: '2026-11-23T08:10:00.000Z',
      fingerprint: 'abcd1234',
      matchesData: true,
      options: { epochs: 5, learningRate: 0.01, batchSize: 16, seed: 42 },
      classNames: ['Mèo', 'Chó'],
      counts: { train: 1, test: 1 },
      metrics: [{ epoch: 1, trainLoss: 0.5, trainAccuracy: 1, testLoss: 0.6, testAccuracy: 1 }],
      guess: { testAccuracy: 0.8 },
      conclusion: 'Đủ 5 epoch là máy phân biệt được',
    },
  ],
};

function rezip(bytes: Uint8Array, change: (files: Record<string, Uint8Array>) => void): Uint8Array {
  const files = unzipSync(bytes);
  change(files);
  return zipSync(files);
}

function readJson(bytes: Uint8Array, name: string): unknown {
  return JSON.parse(new TextDecoder().decode(unzipSync(bytes)[name]));
}

describe('tệp dự án .lup', () => {
  test('dự án ảnh: xuất rồi nhập lại giữ nguyên lớp, ảnh, ngăn, ghi công và nhật ký', () => {
    const decoded = decodeBundle(encodeBundle(imageBundle));
    expect(decoded.manifest).toEqual(imageBundle.manifest);
    expect(decoded.classes).toEqual(['Mèo', 'Chó']);
    expect(decoded.images.map((i) => [i.classIndex, i.split, i.source, i.image.mime])).toEqual([
      [0, 'train', 'upload', 'image/jpeg'],
      [1, 'test', 'dataset', 'image/png'],
    ]);
    expect(Array.from(new Uint8Array(decoded.images[0]?.image.bytes ?? new ArrayBuffer(0)))).toEqual(Array.from(JPEG));
    expect(decoded.images[1]?.credit).toEqual(credit);
    expect(decoded.runs).toEqual(imageBundle.runs);
  });

  test('cấu trúc bên trong: manifest, classes, ảnh trong samples/', () => {
    const files = unzipSync(encodeBundle(imageBundle));
    expect(Object.keys(files).sort()).toEqual(['classes.json', 'images.json', 'manifest.json', 'runs.json', 'samples/00001.jpg', 'samples/00002.png']);
  });

  test('thẻ mô hình đi kèm mọi loại dự án', () => {
    const modelCard = { authors: 'Nhóm 2', purpose: 'Phân loại', data: 'Tự chụp', performance: '9/10', limitations: 'Ảnh tối', misuse: 'Chấm điểm' };
    for (const type of ['image', 'text'] as const) {
      const bytes = encodeBundle({ ...empty(type), modelCard });
      expect(Object.keys(unzipSync(bytes))).toContain('model-card.json');
      expect(decodeBundle(bytes).modelCard).toEqual(modelCard);
    }
    expect(Object.keys(unzipSync(encodeBundle(empty('pose'))))).not.toContain('model-card.json');
    const broken = rezip(encodeBundle({ ...empty('pose'), modelCard }), (files) => {
      files['model-card.json'] = strToU8(JSON.stringify({ ...modelCard, purpose: 'x'.repeat(1001) }));
    });
    expect(() => decodeBundle(broken)).toThrow(/model-card\.json/);
  });

  test('sổ tay ghi chép đi kèm mọi loại dự án', () => {
    const notes = [{ step: 'data', text: 'Có 20 ảnh mèo' }, { step: 'evaluate', text: 'Hay nhầm mèo đen' }];
    for (const type of ['image', 'audio', 'text'] as const) {
      const bytes = encodeBundle({ ...empty(type), notes });
      expect(Object.keys(unzipSync(bytes))).toContain('notebook.json');
      expect(decodeBundle(bytes).notes).toEqual(notes);
    }
    expect(Object.keys(unzipSync(encodeBundle(empty('pose'))))).not.toContain('notebook.json');
    const duplicated = rezip(encodeBundle({ ...empty('pose'), notes }), (files) => {
      files['notebook.json'] = strToU8(JSON.stringify({ notes: [notes[0], notes[0]] }));
    });
    expect(() => decodeBundle(duplicated)).toThrow(/notebook\.json/);
    const tooLong = rezip(encodeBundle({ ...empty('pose'), notes }), (files) => {
      files['notebook.json'] = strToU8(JSON.stringify({ notes: [{ step: 'data', text: 'x'.repeat(2001) }] }));
    });
    expect(() => decodeBundle(tooLong)).toThrow(/notebook\.json/);
  });

  test('dự án âm thanh: giữ đúng từng mẫu âm thanh qua tệp WAV', () => {
    const samples = new Float32Array(16_000).map((_, i) => Math.sin(i / 10) * 0.5);
    const bundle: ProjectBundle = { ...empty('audio'), classes: ['Vỗ tay'], clips: [{ classIndex: 0, source: 'microphone', samples }] };
    const bytes = encodeBundle(bundle);
    expect(Object.keys(unzipSync(bytes))).toContain('audio/00001.wav');
    const decoded = decodeBundle(bytes);
    expect(decoded.clips[0]?.source).toBe('microphone');
    expect(Array.from(decoded.clips[0]?.samples ?? [])).toEqual(Array.from(samples));
  });

  test('dự án tư thế: chỉ có tọa độ khớp', () => {
    const keypoints = Array.from({ length: 17 * 3 }, (_, i) => i / 10);
    const bundle: ProjectBundle = {
      ...empty('pose'),
      classes: ['Giơ tay'],
      poses: [{ classIndex: 0, kind: 'body', source: 'webcam', keypoints, width: 640, height: 480 }],
    };
    expect(decodeBundle(encodeBundle(bundle)).poses).toEqual(bundle.poses);
  });

  test('dự án văn bản: bảng CSV và cấu hình', () => {
    const config = {
      kind: 'text', textColumn: 'cau', labelColumn: 'nhan', testRatio: 0.2, seed: 1, maxN: 1,
      model: { kind: 'naive-bayes', alpha: 1, c: 1 },
    } as const;
    const bundle: ProjectBundle = { ...empty('text'), table: { csv: 'cau,nhan\nngon quá,khen\n', fileName: 'y-kien.csv', sampleId: 'canteen', config } };
    expect(decodeBundle(encodeBundle(bundle)).table).toEqual(bundle.table);
  });

  test('cấu hình bảng hỏng thì bỏ cấu hình, vẫn giữ dữ liệu', () => {
    const bundle: ProjectBundle = { ...empty('tabular'), table: { csv: 'a,b\n1,2\n', fileName: 'x.csv', sampleId: null, config: null } };
    const bytes = rezip(encodeBundle(bundle), (files) => {
      files['table.json'] = strToU8(JSON.stringify({ fileName: 'x.csv', sampleId: null, config: { target: 1 } }));
    });
    const decoded = decodeBundle(bytes);
    expect(decoded.table?.csv).toBe('a,b\n1,2\n');
    expect(decoded.table?.config).toBeNull();
  });

  test('ghi rõ số mẫu âm thanh/ảnh theo thứ tự đã lưu', () => {
    const json = readJson(encodeBundle(imageBundle), 'images.json') as { items: { file: string }[] };
    expect(json.items.map((i) => i.file)).toEqual(['samples/00001.jpg', 'samples/00002.png']);
  });
});

describe('từ chối tệp .lup không hợp lệ', () => {
  const bytes = encodeBundle(imageBundle);

  test('thiếu manifest', () => {
    const broken = rezip(bytes, (files) => delete files['manifest.json']);
    expect(() => decodeBundle(broken)).toThrow(ProjectFileError);
  });

  test('phiên bản định dạng mới hơn ứng dụng', () => {
    const broken = rezip(bytes, (files) => {
      files['manifest.json'] = strToU8(JSON.stringify({ ...imageBundle.manifest, formatVersion: CURRENT_FORMAT_VERSION + 1 }));
    });
    expect(() => decodeBundle(broken)).toThrow(/manifest/);
  });

  test('JSON hỏng', () => {
    const broken = rezip(bytes, (files) => {
      files['classes.json'] = strToU8('{oops');
    });
    expect(() => decodeBundle(broken)).toThrow(/classes\.json/);
  });

  test('ảnh tham chiếu lớp không tồn tại', () => {
    const broken = rezip(bytes, (files) => {
      const json = readJson(bytes, 'images.json') as { items: { class: number }[] };
      files['images.json'] = strToU8(JSON.stringify({ items: json.items.map((i) => ({ ...i, class: 7 })) }));
    });
    expect(() => decodeBundle(broken)).toThrow(/lớp/);
  });

  test('thiếu tệp ảnh được liệt kê', () => {
    const broken = rezip(bytes, (files) => delete files['samples/00001.jpg']);
    expect(() => decodeBundle(broken)).toThrow(/samples\/00001\.jpg/);
  });

  test('tệp "ảnh" không phải JPEG/PNG thật (đổi đuôi)', () => {
    const broken = rezip(bytes, (files) => {
      files['samples/00001.jpg'] = strToU8('<script>alert(1)</script>');
    });
    expect(() => decodeBundle(broken)).toThrow(/không phải ảnh/);
  });

  test('liên kết ghi công không phải https (chặn javascript:)', () => {
    const broken = rezip(bytes, (files) => {
      const json = readJson(bytes, 'images.json') as { items: Record<string, unknown>[] };
      files['images.json'] = strToU8(JSON.stringify({ items: json.items.map((i) => ({ ...i, credit: { ...credit, source: 'javascript:alert(1)' } })) }));
    });
    expect(() => decodeBundle(broken)).toThrow(ProjectFileError);
  });

  test('tên lớp trùng nhau', () => {
    const broken = rezip(bytes, (files) => {
      files['classes.json'] = strToU8(JSON.stringify({ classes: ['Mèo', ' mèo '] }));
    });
    expect(() => decodeBundle(broken)).toThrow(/trùng/);
  });

  test('dữ liệu không đúng loại dự án (ảnh trong dự án âm thanh)', () => {
    const broken = rezip(bytes, (files) => {
      files['manifest.json'] = strToU8(JSON.stringify({ ...imageBundle.manifest, projectType: 'audio' }));
    });
    expect(() => decodeBundle(broken)).toThrow(/loại dự án/);
  });

  test('tư thế sai số khớp', () => {
    const bundle: ProjectBundle = {
      ...empty('pose'),
      classes: ['A'],
      poses: [{ classIndex: 0, kind: 'hand', source: 'webcam', keypoints: [1, 2, 3], width: 10, height: 10 }],
    };
    expect(() => decodeBundle(encodeBundle(bundle))).toThrow(/khớp/);
  });

  test('vượt giới hạn số mẫu mỗi lớp', () => {
    const many = Array.from({ length: 301 }, () => imageBundle.images[0]!);
    expect(() => decodeBundle(encodeBundle({ ...imageBundle, images: many, runs: [] }))).toThrow(/tối đa/);
  });

  test('hai mục cùng trỏ tới một tệp ảnh (nhân bản trong bộ nhớ)', () => {
    const broken = rezip(bytes, (files) => {
      const json = readJson(bytes, 'images.json') as { items: { file: string }[] };
      files['images.json'] = strToU8(JSON.stringify({ items: json.items.map((i) => ({ ...i, file: 'samples/00001.jpg' })) }));
    });
    expect(() => decodeBundle(broken)).toThrow(/dùng nhiều lần/);
  });

  test('kích thước ảnh khai báo khác kích thước thật trong tệp ảnh', () => {
    const broken = rezip(bytes, (files) => {
      files['samples/00001.jpg'] = fakeJpeg(1, 60_000, 60_000);
    });
    expect(() => decodeBundle(broken)).toThrow(/kích thước ảnh không khớp/);
  });

  test('ảnh lớn hơn giới hạn từng tệp bị chặn trước khi giải nén', () => {
    const huge = new Uint8Array(3 * 1024 * 1024);
    huge.set(JPEG);
    const broken = rezip(bytes, (files) => {
      files['samples/00001.jpg'] = huge;
    });
    expect(() => decodeBundle(broken)).toThrow(/quá lớn/);
  });

  test('bảng CSV không đọc được', () => {
    const bundle: ProjectBundle = { ...empty('tabular'), table: { csv: 'a,b\n1,2\n', fileName: 'x.csv', sampleId: null, config: null } };
    const broken = rezip(encodeBundle(bundle), (files) => {
      files['table.csv'] = strToU8('a,b\n"chưa đóng ngoặc,2\n');
    });
    expect(() => decodeBundle(broken)).toThrow(/table\.csv/);
  });

  test('số thứ tự lần chạy trùng nhau', () => {
    const run = imageBundle.runs[0]!;
    expect(() => decodeBundle(encodeBundle({ ...imageBundle, runs: [run, run] }))).toThrow(/tăng dần/);
  });

  test('tên lớp trùng khi so dạng dựng sẵn và dạng tổ hợp của chữ có dấu', () => {
    const broken = rezip(bytes, (files) => {
      files['classes.json'] = strToU8(JSON.stringify({ classes: ['Mèo'.normalize('NFC'), 'Mèo'.normalize('NFD')] }));
    });
    expect(() => decodeBundle(broken)).toThrow(/trùng/);
  });

  test('không phải tệp zip', () => {
    expect(() => decodeBundle(strToU8('xin chào'))).toThrow(ProjectFileError);
  });
});
