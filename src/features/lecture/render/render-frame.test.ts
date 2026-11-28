import i18n from '@/i18n';
import type { ScoredItem } from '@/core/ml/findings';
import { buildImageLecture, type ImageLectureInput } from '../build-image-script';
import type { AspectRatio, LectureScript } from '../lecture-script';
import { buildTimeline } from '../script-timeline';
import { frameLayout, FRAME_SIZES } from './frame-layout';
import { cueAt, renderFrame, sceneAt } from './render-frame';
import type { PaintEnv } from './paint-env';

/** Canvas giả: ghi lại chữ đã vẽ và kiểm tra mọi toạ độ là số hữu hạn. */
function fakeContext() {
  const texts: { text: string; x: number; y: number }[] = [];
  const badCoords: string[] = [];
  const check = (name: string, ...nums: number[]) => {
    if (nums.some((n) => !Number.isFinite(n))) badCoords.push(`${name}(${nums.join(', ')})`);
  };
  const state = { font: '10px sans-serif' };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    get font() {
      return state.font;
    },
    set font(v: string) {
      state.font = v;
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    setLineDash() {},
    fillRect: (x: number, y: number, w: number, h: number) => check('fillRect', x, y, w, h),
    strokeRect: (x: number, y: number, w: number, h: number) => check('strokeRect', x, y, w, h),
    roundRect: (x: number, y: number, w: number, h: number) => check('roundRect', x, y, w, h),
    arc: (x: number, y: number, r: number) => check('arc', x, y, r),
    moveTo: (x: number, y: number) => check('moveTo', x, y),
    lineTo: (x: number, y: number) => check('lineTo', x, y),
    drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => check('drawImage', x, y, w, h),
    fillText: (text: string, x: number, y: number) => {
      check('fillText', x, y);
      texts.push({ text, x, y });
    },
    measureText: (text: string) => ({ width: text.length * (Number(/(\d+)px/.exec(state.font)?.[1]) || 10) * 0.55 }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, badCoords };
}

function items(): ScoredItem[] {
  return [
    { id: 'a', actual: 0, predicted: 0, confidence: 0.9 },
    { id: 'b', actual: 1, predicted: 0, confidence: 0.85 },
    { id: 'c', actual: 1, predicted: 1, confidence: 0.6 },
    { id: 'd', actual: 2, predicted: 2, confidence: 0.7 },
  ];
}

function script(): LectureScript {
  const metrics = Array.from({ length: 20 }, (_, i) => ({ epoch: i + 1, trainLoss: 1 - i * 0.04, trainAccuracy: 0.5 + i * 0.02, testLoss: 0.9, testAccuracy: 0.4 + i * 0.015 }));
  const run = (number: number) => ({ number, options: { epochs: 20, learningRate: 0.001, batchSize: 16, seed: 1 }, classNames: [], counts: { train: 9, test: 4 }, metrics });
  const input: ImageLectureInput = {
    projectName: 'Một tên dự án khá dài để thử ngắt dòng trên khung dọc',
    classNames: ['Lá khỏe', 'Gỉ sắt', 'Một tên lớp rất rất dài cần thu gọn'],
    counts: [
      { train: 3, test: 1 },
      { train: 3, test: 2 },
      { train: 3, test: 1 },
    ],
    runs: [run(1), run(2)],
    evaluation: { items: items() },
    dataChecks: { sameSplitPairs: 1, leakPairs: 0, shortcut: { a: 'Lá khỏe', b: 'Gỉ sắt', accuracy: 0.95 } },
    modelCard: null,
    level: 'expert',
    includeStudentWriting: false,
  };
  return buildImageLecture(i18n.getFixedT('vi'), 'vi', input)!;
}

function env(aspect: AspectRatio): PaintEnv {
  return { t: i18n.getFixedT('vi'), language: 'vi', layout: frameLayout(aspect), thumbs: new Map([[0, [{} as CanvasImageSource]]]) };
}

describe('frameLayout', () => {
  test.each(['16:9', '9:16'] as const)('%s: các vùng nằm trong khung và không chồng nhau theo chiều dọc', (aspect) => {
    const { size, header, visual, subtitle } = frameLayout(aspect);
    expect(size).toEqual(FRAME_SIZES[aspect]);
    for (const r of [header, visual, subtitle]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(size.width);
      expect(r.y + r.h).toBeLessThanOrEqual(size.height);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
    expect(header.y + header.h).toBeLessThanOrEqual(visual.y);
    expect(visual.y + visual.h).toBeLessThanOrEqual(subtitle.y);
  });

  test('9:16 để trống phần đáy cho nút của ứng dụng điện thoại', () => {
    const { size, subtitle } = frameLayout('9:16');
    expect(subtitle.y + subtitle.h).toBeLessThanOrEqual(size.height * 0.85);
  });
});

describe('sceneAt / cueAt', () => {
  const timeline = buildTimeline(script(), '16:9');

  test('thời điểm 0 là cảnh đầu, cuối video là cảnh cuối ở tiến độ 1', () => {
    expect(sceneAt(timeline, 0)).toEqual({ index: 0, progress: 0 });
    expect(sceneAt(timeline, timeline.duration)).toEqual({ index: timeline.scenes.length - 1, progress: 1 });
  });

  test('khoảng nghỉ giữa hai cảnh vẫn thuộc cảnh trước', () => {
    const first = timeline.scenes[0]!;
    expect(sceneAt(timeline, first.end + 0.01).index).toBe(0);
    expect(sceneAt(timeline, timeline.scenes[1]!.start).index).toBe(1);
  });

  test('cueAt trả đúng đoạn phụ đề, giữa hai câu thì không có', () => {
    const cue = timeline.cues[0]!;
    expect(cueAt(timeline.cues, (cue.start + cue.end) / 2)).toBe(cue);
    expect(cueAt(timeline.cues, -1)).toBeNull();
  });
});

describe('renderFrame', () => {
  test.each(['16:9', '9:16'] as const)('%s: vẽ được mọi cảnh ở đầu, giữa, cuối, toạ độ luôn hữu hạn', (aspect) => {
    const s = script();
    const timeline = buildTimeline(s, aspect);
    expect(s.scenes.map((x) => x.visual.kind)).toEqual(['title', 'data', 'data-check', 'network', 'training', 'evaluation', 'experiments', 'limits', 'summary', 'outro']);
    for (const scene of timeline.scenes) {
      for (const f of [0, 0.5, 1]) {
        const { ctx, texts, badCoords } = fakeContext();
        renderFrame(ctx, { script: s, timeline, time: scene.start + (scene.end - scene.start) * f, burnSubtitles: true }, env(aspect));
        expect(badCoords).toEqual([]);
        const shown = s.scenes[timeline.scenes.indexOf(scene)]!;
        if (shown.id !== 'outro') expect(texts.some((x) => x.text === shown.title)).toBe(true);
      }
    }
  });

  test('in phụ đề đúng đoạn đang nói; tắt thì không in', () => {
    const s = script();
    const timeline = buildTimeline(s, '16:9');
    const cue = timeline.cues[2]!;
    const time = (cue.start + cue.end) / 2;
    const on = fakeContext();
    renderFrame(on.ctx, { script: s, timeline, time, burnSubtitles: true }, env('16:9'));
    const firstLine = cue.text.split(String.fromCharCode(10))[0]!;
    expect(on.texts.map((x) => x.text).join(' ')).toContain(firstLine.split(' ')[0]);
    const off = fakeContext();
    renderFrame(off.ctx, { script: s, timeline, time, burnSubtitles: false }, env('16:9'));
    expect(off.texts.length).toBeLessThan(on.texts.length);
  });

  test('cảnh Tóm lại vẽ ba thẻ: kết quả, cần cải thiện (cặp lớp hay nhầm), câu hỏi', () => {
    const s = script();
    const timeline = buildTimeline(s, '16:9');
    const index = s.scenes.findIndex((x) => x.id === 'summary');
    const { ctx, texts } = fakeContext();
    renderFrame(ctx, { script: s, timeline, time: timeline.scenes[index]!.end, burnSubtitles: false }, env('16:9'));
    const all = texts.map((x) => x.text).join(' | ');
    expect(all).toContain('Kết quả');
    expect(all).toContain('Cần cải thiện');
    expect(all).toContain('Câu hỏi cho cả lớp');
    expect(all).toContain('Gỉ sắt');
  });

  test('cảnh kết: dòng chữ LUP Machine, không có thanh tiêu đề cảnh', () => {
    const s = script();
    const timeline = buildTimeline(s, '9:16');
    const last = timeline.scenes.at(-1)!;
    const { ctx, texts, badCoords } = fakeContext();
    renderFrame(ctx, { script: s, timeline, time: last.end, burnSubtitles: true }, env('9:16'));
    expect(badCoords).toEqual([]);
    const all = texts.map((x) => x.text).join(' ');
    expect(all).toContain('Trải nghiệm huấn luyện mô hình AI');
    expect(all).toContain('https://vantupham.github.io/lup-machine');
    // "LUP Machine" luôn nằm trọn trên một dòng (dấu cách không ngắt).
    expect(texts.some((x) => x.text.endsWith(`LUP${String.fromCharCode(0xa0)}Machine`))).toBe(true);
    expect(texts.some((x) => x.text === s.scenes.at(-1)!.title)).toBe(false);
  });

  test('cảnh Đánh giá vẽ đủ ô ma trận với số đếm thật', () => {
    const s = script();
    const timeline = buildTimeline(s, '16:9');
    const index = s.scenes.findIndex((x) => x.id === 'evaluation');
    const { ctx, texts } = fakeContext();
    renderFrame(ctx, { script: s, timeline, time: timeline.scenes[index]!.end, burnSubtitles: false }, env('16:9'));
    const counts = texts.map((x) => x.text).filter((x) => /^\d+$/.test(x));
    // Ma trận [[1,0,0],[1,1,0],[0,0,1]]: năm ô 0, bốn ô 1.
    expect(counts.sort()).toEqual(['0', '0', '0', '0', '0', '1', '1', '1', '1']);
  });
});
