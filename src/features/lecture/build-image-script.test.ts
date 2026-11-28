import i18n from '@/i18n';
import type { ScoredItem } from '@/core/ml/findings';
import { buildImageLecture, type ImageLectureInput, type LectureRun } from './build-image-script';
import type { LectureScript } from './lecture-script';

const vi = i18n.getFixedT('vi');
const en = i18n.getFixedT('en');

function metrics(epochs: number, finalTrain: number, finalTest: number | null) {
  return Array.from({ length: epochs }, (_, i) => ({
    epoch: i + 1,
    trainLoss: 1.1 - (i / (epochs - 1)) * 0.8,
    trainAccuracy: i === epochs - 1 ? finalTrain : 0.4,
    testLoss: finalTest === null ? null : 0.9,
    testAccuracy: i === epochs - 1 ? finalTest : 0.3,
  }));
}

function run(number: number, finalTest: number | null, extra: Partial<LectureRun> = {}): LectureRun {
  return {
    number,
    options: { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 1 },
    classNames: ['Lá khỏe', 'Gỉ sắt', 'Đốm góc'],
    counts: { train: 72, test: 18 },
    metrics: metrics(50, 0.95, finalTest),
    ...extra,
  };
}

/** 18 ảnh Kiểm tra: 13 đúng, Gỉ sắt bị nhầm 3 ảnh sang Đốm góc (1 ảnh rất chắc chắn). */
function items(): ScoredItem[] {
  const out: ScoredItem[] = [];
  const push = (actual: number, predicted: number, confidence = 0.6) => out.push({ id: `i${out.length}`, actual, predicted, confidence });
  for (let i = 0; i < 6; i++) push(0, 0);
  for (let i = 0; i < 3; i++) push(1, 1);
  push(1, 2, 0.91);
  push(1, 2);
  push(1, 2);
  for (let i = 0; i < 4; i++) push(2, 2);
  push(2, 0);
  push(2, 1);
  return out;
}

function baseInput(overrides: Partial<ImageLectureInput> = {}): ImageLectureInput {
  return {
    projectName: 'Bác sĩ lá đậu',
    classNames: ['Lá khỏe', 'Gỉ sắt', 'Đốm góc'],
    counts: [
      { train: 24, test: 6 },
      { train: 24, test: 6 },
      { train: 24, test: 6 },
    ],
    runs: [run(1, 0.611), run(2, 0.722, { guess: { testAccuracy: 0.8 }, conclusion: 'Em nghĩ cần thêm ảnh gỉ sắt.' })],
    evaluation: { items: items() },
    dataChecks: { sameSplitPairs: 0, leakPairs: 2, shortcut: null },
    modelCard: null,
    level: 'explore',
    includeStudentWriting: false,
    ...overrides,
  };
}

const allText = (script: LectureScript) => script.scenes.flatMap((s) => [s.title, ...s.lines.flatMap((l) => [l.display, l.spoken])]).join('\n');
const sceneIds = (script: LectureScript) => script.scenes.map((s) => s.id);
const lines = (script: LectureScript, id: string) => script.scenes.find((s) => s.id === id)?.lines ?? [];

describe('buildImageLecture', () => {
  test('chưa huấn luyện lần nào thì không dựng được bài giảng', () => {
    expect(buildImageLecture(vi, 'vi', baseInput({ runs: [] }))).toBeNull();
  });

  test('đủ các cảnh theo thứ tự khi có dữ liệu cho từng cảnh', () => {
    const script = buildImageLecture(vi, 'vi', baseInput());
    expect(sceneIds(script!)).toEqual(['title', 'data', 'data-check', 'network', 'training', 'evaluation', 'experiments', 'limits', 'summary']);
  });

  test('bỏ cảnh Kiểm tra dữ liệu khi chưa soi, bỏ cảnh Thí nghiệm khi mới chạy một lần, bỏ Đánh giá khi không có dự đoán', () => {
    const script = buildImageLecture(vi, 'vi', baseInput({ dataChecks: null, runs: [run(1, 0.722)], evaluation: null }));
    expect(sceneIds(script!)).toEqual(['title', 'data', 'network', 'training', 'limits', 'summary']);
  });

  test('không còn biến {{...}} chưa điền, ở cả hai ngôn ngữ và hai mức', () => {
    for (const [t, lang] of [
      [vi, 'vi'],
      [en, 'en'],
    ] as const) {
      for (const level of ['explore', 'expert'] as const) {
        const text = allText(buildImageLecture(t, lang, baseInput({ level }))!);
        expect(text).not.toMatch(/\{\{|\}\}|lecture\./);
      }
    }
  });

  test('phụ đề giữ chữ số, lời đọc tiếng Việt viết số bằng chữ', () => {
    const training = lines(buildImageLecture(vi, 'vi', baseInput())!, 'training');
    const accuracy = training.find((l) => l.display.includes('72,2%'));
    expect(accuracy?.spoken).toContain('bảy mươi hai phẩy hai phần trăm');
    expect(accuracy?.spoken).not.toMatch(/\d/);
  });

  test('mọi lời đọc tiếng Việt không còn chữ số', () => {
    const script = buildImageLecture(vi, 'vi', baseInput({ level: 'expert' }))!;
    const withDigits = script.scenes.flatMap((s) => s.lines.map((l) => l.spoken)).filter((s) => /\d/.test(s));
    expect(withDigits).toEqual([]);
  });

  test('tiếng Anh: lời đọc trùng phụ đề', () => {
    const script = buildImageLecture(en, 'en', baseInput())!;
    for (const scene of script.scenes) for (const line of scene.lines) expect(line.spoken).toBe(line.display);
  });

  test('số liệu dữ liệu lấy đúng từ dự án', () => {
    const data = lines(buildImageLecture(vi, 'vi', baseInput())!, 'data').map((l) => l.display);
    expect(data[0]).toContain('90 ảnh');
    expect(data[0]).toContain('72');
    expect(data[0]).toContain('18');
  });

  test('cảnh Đánh giá nêu lớp hay bị nhầm và số ảnh đúng', () => {
    const evaluation = lines(buildImageLecture(vi, 'vi', baseInput())!, 'evaluation').map((l) => l.display).join(' ');
    expect(evaluation).toContain('13');
    expect(evaluation).toContain('Gỉ sắt');
    expect(evaluation).toContain('Đốm góc');
  });

  test('báo rò rỉ dữ liệu khi có cặp ảnh Kiểm tra gần trùng ảnh Huấn luyện', () => {
    const check = lines(buildImageLecture(vi, 'vi', baseInput())!, 'data-check').map((l) => l.display).join(' ');
    expect(check).toContain('2 cặp');
  });

  test('báo chênh lệch lớn giữa Huấn luyện và Kiểm tra', () => {
    const training = lines(buildImageLecture(vi, 'vi', baseInput())!, 'training').map((l) => l.display).join(' ');
    expect(training).toContain('22,8');
  });

  test('mặc định không đưa chữ học sinh viết (kết luận, thẻ mô hình) vào video', () => {
    const modelCard = { authors: 'Nhóm 3', purpose: '', data: '', performance: '', limitations: 'Ảnh chụp tối dễ sai.', misuse: '' };
    const hidden = allText(buildImageLecture(vi, 'vi', baseInput({ modelCard }))!);
    expect(hidden).not.toContain('Em nghĩ');
    expect(hidden).not.toContain('Ảnh chụp tối');
    expect(hidden).not.toContain('Nhóm 3');

    const shown = allText(buildImageLecture(vi, 'vi', baseInput({ modelCard, includeStudentWriting: true }))!);
    expect(shown).toContain('Em nghĩ cần thêm ảnh gỉ sắt.');
    expect(shown).toContain('Ảnh chụp tối dễ sai.');
  });

  test('mức Chuyên gia có thêm số tầng và số tham số của mạng', () => {
    const explore = lines(buildImageLecture(vi, 'vi', baseInput())!, 'network').length;
    const expert = lines(buildImageLecture(vi, 'vi', baseInput({ level: 'expert' }))!, 'network');
    expect(expert.length).toBeGreaterThan(explore);
    expect(expert.map((l) => l.display).join(' ')).toContain('155');
  });

  test('cảnh mang theo số liệu để dựng hình', () => {
    const script = buildImageLecture(vi, 'vi', baseInput())!;
    const training = script.scenes.find((s) => s.id === 'training');
    expect(training?.visual.kind).toBe('training');
    if (training?.visual.kind === 'training') expect(training.visual.metrics).toHaveLength(50);
    const evaluation = script.scenes.find((s) => s.id === 'evaluation');
    if (evaluation?.visual.kind === 'evaluation') expect(evaluation.visual.matrix[1]).toEqual([0, 3, 3]);
  });
});
