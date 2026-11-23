import { code, float32ToBase64, markdown, notebook, notebookFileName, pyList, pyNumber, pyString, serializeNotebook } from './notebook';

describe('notebook', () => {
  test('ô mã và ô văn bản theo nbformat 4: mỗi dòng giữ ký tự xuống dòng trừ dòng cuối', () => {
    const nb = notebook([markdown('# Tiêu đề', 'dòng 2'), code('x = 1\ny = 2')]);
    expect(nb.nbformat).toBe(4);
    expect(nb.cells[0]).toEqual({ cell_type: 'markdown', metadata: {}, source: ['# Tiêu đề\n', 'dòng 2'] });
    expect(nb.cells[1]).toMatchObject({ cell_type: 'code', source: ['x = 1\n', 'y = 2'], outputs: [], execution_count: null });
    expect(JSON.parse(serializeNotebook(nb))).toEqual(nb);
  });

  test('chuỗi Python an toàn với ngoặc kép, gạch chéo, xuống dòng và ký tự ngắt dòng Unicode', () => {
    expect(pyString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    expect(pyString('x\u2028y')).toBe('"x\\u2028y"');
    expect(pyString('Đảo')).toBe('"Đảo"');
    expect(pyList(['a', 1.5, -2])).toBe('["a", 1.5, -2]');
  });

  test('số in ra đọc lại đúng giá trị; số không hữu hạn bị từ chối', () => {
    expect(Number(pyNumber(0.1 + 0.2))).toBe(0.1 + 0.2);
    expect(() => pyNumber(Number.NaN)).toThrow(RangeError);
  });

  test('float32 base64 little-endian giải mã lại đúng từng giá trị', () => {
    const b64 = float32ToBase64([new Float32Array([1, -2.5]), [0.1, 3]]);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const back = new Float32Array(bytes.buffer);
    expect(Array.from(back)).toEqual([1, -2.5, Math.fround(0.1), 3]);
    expect(() => float32ToBase64([[1, 2], [3]])).toThrow(RangeError);
    expect(float32ToBase64([])).toBe('');
  });

  test('tên tệp bỏ dấu tiếng Việt và ký tự lạ', () => {
    expect(notebookFileName('Chim cánh cụt – Lớp 7A!')).toBe('chim-canh-cut-lop-7a-lup-machine.ipynb');
    expect(notebookFileName('Đậu đỏ')).toBe('dau-do-lup-machine.ipynb');
    expect(notebookFileName('!!!')).toBe('du-an-lup-machine.ipynb');
  });
});
