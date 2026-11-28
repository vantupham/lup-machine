import { estimateSpeechSeconds, SPEECH_SYLLABLES_PER_SECOND, splitCueTexts, timeCues, toSrt, toVtt, wrapLines, type Cue } from './subtitles';

const syllables = (text: string) => text.trim().split(/\s+/).length;

describe('splitCueTexts', () => {
  test('câu ngắn giữ nguyên một đoạn', () => {
    expect(splitCueTexts('Mỗi lớp có 30 ảnh.', 42)).toEqual(['Mỗi lớp có 30 ảnh.']);
  });

  test('tách theo câu trước', () => {
    expect(splitCueTexts('Lớp A có 30 ảnh. Lớp B có 28 ảnh.', 20)).toEqual(['Lớp A có 30 ảnh.', 'Lớp B có 28 ảnh.']);
  });

  test('câu dài tách theo dấu phẩy, rồi theo từ; không đoạn nào vượt giới hạn', () => {
    const text = 'Sau năm mươi epoch, mô hình đoán đúng bảy mươi hai phẩy hai phần trăm ảnh kiểm tra của cả ba lớp lá đậu.';
    const cues = splitCueTexts(text, 28);
    expect(cues[0]).toBe('Sau năm mươi epoch,');
    for (const cue of cues) expect(cue.length).toBeLessThanOrEqual(28);
    expect(cues.join(' ')).toBe(text);
  });

  test('cắt theo từ thì chia đều, không để đuôi quá ngắn', () => {
    const cues = splitCueTexts('Video này kể lại máy đã học từ chính dữ liệu của dự án như thế nào.', 56);
    expect(cues).toHaveLength(2);
    const [a, b] = cues.map((c) => c.length);
    expect(Math.abs(a! - b!)).toBeLessThan(12);
  });

  test('một từ dài hơn giới hạn vẫn đứng riêng (không cắt giữa từ)', () => {
    expect(splitCueTexts('a https://vantupham.github.io/lup-machine b', 10)).toEqual(['a', 'https://vantupham.github.io/lup-machine', 'b']);
  });

  test('bỏ khoảng trắng thừa, chuỗi rỗng cho ra mảng rỗng', () => {
    expect(splitCueTexts('   ', 42)).toEqual([]);
    expect(splitCueTexts('  Một   hai  ', 42)).toEqual(['Một hai']);
  });

  test('từ chối giới hạn không hợp lệ', () => {
    expect(() => splitCueTexts('x', 0)).toThrow(RangeError);
    expect(() => splitCueTexts('x', 10, 0)).toThrow(RangeError);
  });

  test('hai dòng mỗi đoạn: mọi đoạn ngắt được thành tối đa 2 dòng, kể cả khi từ dài', () => {
    const long = `${'a'.repeat(41)} ${'b'.repeat(41)} c`;
    const cues = splitCueTexts(long, 42, 2);
    for (const cue of cues) expect(wrapLines(cue, 42).length).toBeLessThanOrEqual(2);
    expect(cues.join(' ')).toBe(long);
  });

  test('hai dòng mỗi đoạn: câu vừa hai dòng thì giữ một đoạn', () => {
    const text = 'Video này kể lại máy đã học từ chính dữ liệu của dự án như thế nào.';
    expect(splitCueTexts(text, 42, 2)).toEqual([text]);
  });
});

describe('wrapLines', () => {
  test('vừa một dòng thì giữ nguyên', () => {
    expect(wrapLines('Xin chào.', 42)).toEqual(['Xin chào.']);
  });

  test('hai dòng dài gần bằng nhau', () => {
    const [a, b] = wrapLines('Video này kể lại máy đã học từ chính dữ liệu của dự án như thế nào.', 42);
    expect(a!.length).toBeLessThanOrEqual(42);
    expect(b!.length).toBeLessThanOrEqual(42);
    expect(Math.abs(a!.length - b!.length)).toBeLessThan(10);
  });

  test('không chia được hai dòng thì ngắt nhiều dòng, từ quá dài đứng riêng', () => {
    expect(wrapLines('aaaa bbbb cccc', 4)).toEqual(['aaaa', 'bbbb', 'cccc']);
    expect(wrapLines('a bbbbbbbbbb c', 4)).toEqual(['a', 'bbbbbbbbbb', 'c']);
  });
});

describe('estimateSpeechSeconds', () => {
  test('theo số âm tiết của lời đọc', () => {
    expect(estimateSpeechSeconds('một hai ba bốn năm sáu')).toBeCloseTo(6 / SPEECH_SYLLABLES_PER_SECOND, 6);
    expect(estimateSpeechSeconds('  ')).toBe(0);
  });
});

describe('timeCues', () => {
  test('chia thời lượng theo số âm tiết, nối liền nhau từ mốc bắt đầu', () => {
    const cues = timeCues(['một hai ba', 'bốn'], 10, 4);
    expect(cues).toEqual([
      { start: 10, end: 13, text: 'một hai ba' },
      { start: 13, end: 14, text: 'bốn' },
    ]);
  });

  test('đoạn cuối kết thúc đúng mốc (không lệch do làm tròn)', () => {
    const texts = ['a b', 'c d e', 'f'];
    const cues = timeCues(texts, 1.5, 7);
    expect(cues.at(-1)?.end).toBe(8.5);
    const total = texts.reduce((s, t) => s + syllables(t), 0);
    expect(cues[1]!.end - cues[1]!.start).toBeCloseTo((7 * 3) / total, 9);
  });

  test('không có đoạn nào thì trả mảng rỗng', () => {
    expect(timeCues([], 0, 5)).toEqual([]);
  });
});

describe('toSrt / toVtt', () => {
  const cues: Cue[] = [
    { start: 0, end: 2.5, text: 'Xin chào.' },
    { start: 2.5, end: 3661.042, text: 'Mỗi lớp có 30 ảnh.' },
  ];

  test('SRT: đánh số từ 1, giờ dạng 00:00:02,500, cách nhau một dòng trống', () => {
    expect(toSrt(cues)).toBe('1\n00:00:00,000 --> 00:00:02,500\nXin chào.\n\n2\n00:00:02,500 --> 01:01:01,042\nMỗi lớp có 30 ảnh.\n');
  });

  test('VTT: có tiêu đề WEBVTT, giờ dùng dấu chấm', () => {
    expect(toVtt(cues)).toBe('WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nXin chào.\n\n00:00:02.500 --> 01:01:01.042\nMỗi lớp có 30 ảnh.\n');
  });

  test('VTT không để lọt chuỗi "-->" trong lời thoại', () => {
    expect(toVtt([{ start: 0, end: 1, text: 'A --> B' }])).toContain('A → B');
  });
});
