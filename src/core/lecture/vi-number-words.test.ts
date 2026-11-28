import { decimalToWords, integerToWords, percentToWords, speakNumbersInText, viNumberTextToWords } from './vi-number-words';

describe('integerToWords (đọc số nguyên tiếng Việt)', () => {
  test.each([
    [0, 'không'],
    [1, 'một'],
    [5, 'năm'],
    [10, 'mười'],
    [11, 'mười một'],
    [14, 'mười bốn'],
    [15, 'mười lăm'],
    [20, 'hai mươi'],
    [21, 'hai mươi mốt'],
    [24, 'hai mươi tư'],
    [25, 'hai mươi lăm'],
    [30, 'ba mươi'],
    [100, 'một trăm'],
    [105, 'một trăm linh năm'],
    [110, 'một trăm mười'],
    [155, 'một trăm năm mươi lăm'],
    [1000, 'một nghìn'],
    [1005, 'một nghìn không trăm linh năm'],
    [1024, 'một nghìn không trăm hai mươi tư'],
    [2000000, 'hai triệu'],
    [410208, 'bốn trăm mười nghìn hai trăm linh tám'],
    [1000001, 'một triệu không trăm linh một'],
    [-3, 'âm ba'],
  ])('%i → %s', (value, words) => {
    expect(integerToWords(value)).toBe(words);
  });

  test('từ chối số không phải số nguyên hữu hạn', () => {
    expect(() => integerToWords(1.5)).toThrow(RangeError);
    expect(() => integerToWords(Number.NaN)).toThrow(RangeError);
  });
});

describe('decimalToWords', () => {
  test('phần thập phân không có số 0 đứng đầu đọc như một số', () => {
    expect(decimalToWords('72,2')).toBe('bảy mươi hai phẩy hai');
    expect(decimalToWords('0,85')).toBe('không phẩy tám mươi lăm');
  });

  test('phần thập phân có số 0 đứng đầu đọc từng chữ số', () => {
    expect(decimalToWords('0,05')).toBe('không phẩy không năm');
  });

  test('chấp nhận dấu chấm, số nguyên và dấu âm', () => {
    expect(decimalToWords('3.5')).toBe('ba phẩy năm');
    expect(decimalToWords('12')).toBe('mười hai');
    expect(decimalToWords('-0,5')).toBe('âm không phẩy năm');
  });

  test('từ chối chuỗi không phải số', () => {
    expect(() => decimalToWords('abc')).toThrow(RangeError);
  });
});

describe('số dài và số viết tự do', () => {
  test('số quá dài hoặc có số 0 đứng đầu đọc từng chữ số, không ném lỗi', () => {
    expect(decimalToWords('12345678901234567890')).toBe('một hai ba bốn năm sáu bảy tám chín không một hai ba bốn năm sáu bảy tám chín không');
    expect(decimalToWords('007')).toBe('không không bảy');
    expect(decimalToWords('3,14159265358979323846')).toMatch(/^ba phẩy một bốn một năm/);
  });

  test('viNumberTextToWords: chấm theo nhóm ba là tách nghìn', () => {
    expect(viNumberTextToWords('1.280')).toBe('một nghìn hai trăm tám mươi');
    expect(viNumberTextToWords('2.257.984')).toBe('hai triệu hai trăm năm mươi bảy nghìn chín trăm tám mươi tư');
    expect(viNumberTextToWords('3.5')).toBe('ba phẩy năm');
  });

  test('speakNumbersInText chỉ đọc số đứng riêng', () => {
    expect(speakNumbersInText('Lớp 1 và MobileNetV2, 1.000 ảnh, 0,5')).toBe('Lớp một và MobileNetV2, một nghìn ảnh, không phẩy năm');
    expect(speakNumbersInText('Lớp 12345678901234567890')).toContain('một hai ba');
  });
});

describe('percentToWords', () => {
  test('làm tròn đến số chữ số yêu cầu rồi đọc kèm "phần trăm"', () => {
    expect(percentToWords(0.7222, 1)).toBe('bảy mươi hai phẩy hai phần trăm');
    expect(percentToWords(0.5, 0)).toBe('năm mươi phần trăm');
    expect(percentToWords(1, 1)).toBe('một trăm phần trăm');
  });

  test('bỏ đuôi ",0" như cách hiển thị', () => {
    expect(percentToWords(0.75, 1)).toBe('bảy mươi lăm phần trăm');
  });
});
