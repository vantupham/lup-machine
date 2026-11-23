import { checkTextQuality } from './text-quality';

const many = (label: string, n: number) => Array.from({ length: n }, (_, i) => ({ label, text: `Câu số ${i} của lớp ${label}` }));

describe('checkTextQuality', () => {
  test('dữ liệu tốt: không có vấn đề', () => {
    expect(checkTextQuality([...many('khen', 8), ...many('chê', 8)])).toEqual([]);
  });

  test('mất cân bằng, lớp quá ít câu, câu bị bỏ', () => {
    const issues = checkTextQuality([...many('khen', 12), ...many('chê', 3), { label: '', text: 'không nhãn' }]);
    expect(issues).toContainEqual({ kind: 'dropped', count: 1 });
    expect(issues).toContainEqual({ kind: 'imbalance', smallest: 'chê', smallestCount: 3, largest: 'khen', largestCount: 12 });
    expect(issues).toContainEqual({ kind: 'few-examples', label: 'chê', count: 3 });
  });

  test('câu trùng (không phân biệt hoa thường, dấu câu) và câu mâu thuẫn nhãn', () => {
    const issues = checkTextQuality([
      ...many('khen', 6),
      ...many('chê', 6),
      { label: 'khen', text: 'Cơm ngon quá!' },
      { label: 'khen', text: 'cơm ngon quá' },
      { label: 'chê', text: 'Cơm NGON quá.' },
    ]);
    expect(issues).toContainEqual({ kind: 'duplicates', count: 2 });
    expect(issues).toContainEqual({ kind: 'conflict', text: 'Cơm ngon quá!', labels: 'khen / chê' });
  });

  test('câu quá ngắn', () => {
    expect(checkTextQuality([...many('a', 6), ...many('b', 6), { label: 'a', text: 'Ngon!' }])).toContainEqual({ kind: 'short', count: 1 });
  });
});
