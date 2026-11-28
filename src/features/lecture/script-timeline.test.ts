import { estimateSpeechSeconds } from '@/core/lecture/subtitles';
import { buildTimeline, CUE_LINES, LINE_GAP, lineSecondsWithVoices, SCENE_GAP, SILENT_SCENE_SECONDS, spokenWeight, subtitleLineChars } from './script-timeline';
import type { LectureScript } from './lecture-script';

const script: LectureScript = {
  language: 'vi',
  level: 'explore',
  scenes: [
    {
      id: 'title',
      title: 'Giới thiệu',
      lines: [
        { display: 'Dự án Lá đậu dạy máy phân biệt 3 lớp ảnh.', spoken: 'Dự án Lá đậu dạy máy phân biệt ba lớp ảnh.' },
        { display: 'Video này kể lại máy đã học như thế nào.', spoken: 'Video này kể lại máy đã học như thế nào.' },
      ],
      visual: { kind: 'title', projectName: 'Lá đậu', classNames: ['A', 'B', 'C'] },
    },
    {
      id: 'summary',
      title: 'Tóm lại',
      lines: [{ display: 'Tóm lại, mô hình đoán đúng 72,2% ảnh kiểm tra.', spoken: 'Tóm lại, mô hình đoán đúng bảy mươi hai phẩy hai phần trăm ảnh kiểm tra.' }],
      visual: { kind: 'summary', score: { split: 'test', accuracy: 0.722 }, confusion: null },
    },
  ],
};

describe('subtitleLineChars', () => {
  test('khổ dọc hẹp hơn nên mỗi dòng phụ đề ngắn hơn', () => {
    expect(subtitleLineChars('16:9')).toBeGreaterThan(subtitleLineChars('9:16'));
  });
});

describe('spokenWeight', () => {
  test('số tính theo số âm tiết khi đọc', () => {
    expect(spokenWeight('đúng 72,2% ảnh', 'vi')).toBe(1 + 7 + 1);
    expect(spokenWeight('có 30 ảnh', 'vi')).toBe(1 + 2 + 1);
    expect(spokenWeight('nối 1.280 đặc trưng', 'vi')).toBe(1 + 6 + 2);
    expect(spokenWeight('2.257.984 tham số', 'vi')).toBe(13 + 2);
  });

  test('ngôn ngữ khác: mỗi từ một nhịp', () => {
    expect(spokenWeight('got 72.2% right', 'en')).toBe(3);
  });
});

describe('buildTimeline', () => {
  test('ước lượng thời lượng theo lời đọc khi chưa có âm thanh, có khoảng nghỉ giữa câu và giữa cảnh', () => {
    const timeline = buildTimeline(script, '16:9');
    const [l1, l2] = script.scenes[0]!.lines;
    const expectedTitle = estimateSpeechSeconds(l1!.spoken) + LINE_GAP + estimateSpeechSeconds(l2!.spoken);
    expect(timeline.scenes[0]).toEqual({ id: 'title', start: 0, end: expect.closeTo(expectedTitle, 6) });
    expect(timeline.scenes[1]!.start).toBeCloseTo(expectedTitle + SCENE_GAP, 6);
    expect(timeline.duration).toBeCloseTo(timeline.scenes[1]!.end, 9);
  });

  test('dùng thời lượng âm thanh thật khi có', () => {
    const timeline = buildTimeline(script, '16:9', [[2, 3], [4]]);
    expect(timeline.scenes[0]!.end).toBeCloseTo(2 + LINE_GAP + 3, 9);
    expect(timeline.duration).toBeCloseTo(2 + LINE_GAP + 3 + SCENE_GAP + 4, 9);
  });

  test('phụ đề lấy chữ hiển thị, nằm trong khoảng của câu, không đoạn nào vượt giới hạn', () => {
    const timeline = buildTimeline(script, '9:16', [[2, 3], [4]]);
    for (const cue of timeline.cues) {
      const lines = cue.text.split(String.fromCharCode(10));
      expect(lines.length).toBeLessThanOrEqual(CUE_LINES);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(subtitleLineChars('9:16'));
    }
    expect(timeline.cues.some((c) => c.text.includes('72,2%'))).toBe(true);
    const last = timeline.cues.at(-1)!;
    expect(last.end).toBeCloseTo(timeline.duration, 9);
    for (let i = 1; i < timeline.cues.length; i++) expect(timeline.cues[i]!.start).toBeGreaterThanOrEqual(timeline.cues[i - 1]!.end - 1e-9);
  });

  test('có giọng thu: cảnh dài đúng bằng bản thu, cảnh chưa thu thì ước lượng', () => {
    const seconds = lineSecondsWithVoices(script, [9, null]);
    const timeline = buildTimeline(script, '16:9', seconds);
    expect(timeline.scenes[0]!.end - timeline.scenes[0]!.start).toBeCloseTo(9, 9);
    expect(seconds[1]).toEqual([estimateSpeechSeconds(script.scenes[1]!.lines[0]!.spoken)]);
    // Hai câu chia theo độ dài đọc.
    const [a, b] = seconds[0]!;
    const [ea, eb] = script.scenes[0]!.lines.map((l) => estimateSpeechSeconds(l.spoken));
    expect(a! / b!).toBeCloseTo(ea! / eb!, 9);
  });

  test('bản thu quá ngắn so với khoảng nghỉ: câu vẫn có thời lượng dương', () => {
    const seconds = lineSecondsWithVoices(script, [0.1, 3]);
    for (const s of seconds.flat()) expect(s).toBeGreaterThan(0);
  });

  test('cảnh không có lời (cảnh kết) vẫn hiện một khoảng cố định, không có phụ đề', () => {
    const withOutro: LectureScript = {
      ...script,
      scenes: [...script.scenes, { id: 'outro', title: 'Kết thúc', lines: [], visual: { kind: 'outro' } }],
    };
    const plain = buildTimeline(script, '16:9');
    const timeline = buildTimeline(withOutro, '16:9');
    const outro = timeline.scenes.at(-1)!;
    expect(outro.end - outro.start).toBeCloseTo(SILENT_SCENE_SECONDS, 9);
    expect(timeline.cues).toEqual(plain.cues);
    expect(lineSecondsWithVoices(withOutro, [null, null, null]).at(-1)).toEqual([]);
    expect(buildTimeline(withOutro, '16:9', lineSecondsWithVoices(withOutro, [5, null, null])).scenes.at(-1)!.end).toBeGreaterThan(5);
  });

  test('từ chối số thời lượng không khớp số câu', () => {
    expect(() => buildTimeline(script, '16:9', [[2], [4]])).toThrow(RangeError);
  });
});
