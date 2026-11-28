import type { ClassRecord, RunRecord, SampleRecord } from '@/storage/db';
import type { SamplePrediction } from '@/features/studio/image/lab/lab-data';
import { imageLectureInput, testEvaluation, type ImageLectureSources } from './image-lecture-input';

const classes: ClassRecord[] = [
  { id: 'c1', projectId: 'p', name: 'Mèo', order: 0, createdAt: '' },
  { id: 'c2', projectId: 'p', name: 'Chó', order: 1, createdAt: '' },
];

function sample(id: string, classId: string, split: 'train' | 'test'): SampleRecord {
  return { id, projectId: 'p', classId, split, source: 'upload', image: { bytes: new ArrayBuffer(0), mime: 'image/jpeg', width: 224, height: 224 }, createdAt: '' };
}

const samples = [sample('a', 'c1', 'train'), sample('b', 'c1', 'test'), sample('c', 'c2', 'train'), sample('d', 'c2', 'train'), sample('e', 'c2', 'test')];

function run(number: number): RunRecord {
  return {
    id: `r${number}`,
    projectId: 'p',
    number,
    createdAt: '',
    fingerprint: 'f',
    options: { epochs: 10, learningRate: 0.001, batchSize: 16, seed: 1 },
    classNames: ['Mèo', 'Chó'],
    counts: { train: 3, test: 2 },
    metrics: [],
  };
}

const pred = (actual: number, predicted: number, probs: number[]): SamplePrediction => ({ actual, predicted, isCorrect: actual === predicted, probabilities: Float64Array.from(probs) });

function sources(overrides: Partial<ImageLectureSources> = {}): ImageLectureSources {
  return {
    projectName: 'Thú cưng',
    classes,
    samples,
    runs: [run(2), run(1)],
    current: {
      runNumber: 2,
      fingerprint: 'f',
      isStale: false,
      isTraining: false,
      isFinalEpoch: true,
      predictions: new Map([
        ['a', pred(0, 0, [0.9, 0.1])],
        ['b', pred(0, 1, [0.3, 0.7])],
        ['e', pred(1, 1, [0.2, 0.8])],
      ]),
    },
    deepCheck: null,
    modelCard: null,
    level: 'explore',
    includeStudentWriting: false,
    ...overrides,
  };
}

describe('testEvaluation', () => {
  test('chỉ lấy ảnh Kiểm tra, độ tin cậy là xác suất của lớp máy đoán', () => {
    expect(testEvaluation(sources())?.items).toEqual([
      { id: 'b', actual: 0, predicted: 1, confidence: 0.7 },
      { id: 'e', actual: 1, predicted: 1, confidence: 0.8 },
    ]);
  });

  test.each([
    ['mô hình đang mở là lần cũ', { runNumber: 1 }],
    ['dữ liệu đã đổi sau khi huấn luyện', { isStale: true }],
    ['đang huấn luyện', { isTraining: true }],
    ['đang xem một epoch giữa chừng', { isFinalEpoch: false }],
    ['dữ liệu đã sửa rồi chạy lại đúng lần mới nhất', { fingerprint: 'khác' }],
  ])('không dùng dự đoán khi %s', (_name, change) => {
    expect(testEvaluation(sources({ current: { ...sources().current, ...change } }))).toBeNull();
  });
});

describe('imageLectureInput', () => {
  test('đếm ảnh theo lớp và tập, nhật ký xếp lại từ cũ đến mới', () => {
    const input = imageLectureInput(sources());
    expect(input.counts).toEqual([
      { train: 1, test: 1 },
      { train: 2, test: 1 },
    ]);
    expect(input.runs.map((r) => r.number)).toEqual([1, 2]);
    expect(input.classNames).toEqual(['Mèo', 'Chó']);
  });

  test('tóm tắt kết quả soi kỹ: rò rỉ, trùng cùng tập, lối tắt nền mạnh nhất', () => {
    const input = imageLectureInput(
      sources({
        deepCheck: {
          duplicates: [
            { a: 0, b: 1, diff: 3, isLeak: true },
            { a: 2, b: 3, diff: 5, isLeak: false },
            { a: 1, b: 4, diff: 2, isLeak: true },
          ],
          backgrounds: [
            { a: 0, b: 1, accuracy: 0.95, cut: 100, gap: 60, brighter: 1, isShortcut: true },
            { a: 0, b: 1, accuracy: 0.7, cut: 100, gap: 10, brighter: 0, isShortcut: false },
          ],
        },
      }),
    );
    expect(input.dataChecks).toEqual({ leakPairs: 2, sameSplitPairs: 1, shortcut: { a: 'Mèo', b: 'Chó', accuracy: 0.95 } });
  });

  test('chưa soi xong thì không có cảnh Soi kỹ', () => {
    expect(imageLectureInput(sources()).dataChecks).toBeNull();
  });
});
