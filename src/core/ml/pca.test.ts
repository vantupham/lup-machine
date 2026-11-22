import reference from '../../../tests/fixtures/pca-reference.json';
import { fitPca2, projectPca } from './pca';

const TOLERANCE = 1e-6;

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

describe('fitPca2 – đối chiếu với scikit-learn', () => {
  const model = fitPca2(reference.x);

  test('vector trung bình khớp', () => {
    reference.mean.forEach((m, i) => expect(model.mean[i]).toBeCloseTo(m, 6));
  });

  test('tỉ lệ phương sai giữ lại khớp', () => {
    expect(model.explainedVarianceRatio[0]).toBeCloseTo(reference.explainedVarianceRatio[0]!, 6);
    expect(model.explainedVarianceRatio[1]).toBeCloseTo(reference.explainedVarianceRatio[1]!, 6);
  });

  test('các thành phần chính khớp (sai khác dấu được chấp nhận)', () => {
    for (let c = 0; c < 2; c++) {
      const cos = dot(model.components[c]!, reference.components[c]!);
      expect(Math.abs(cos)).toBeGreaterThan(1 - TOLERANCE);
    }
  });

  test('tọa độ 2D khớp với sklearn.transform (sai khác dấu theo từng trục)', () => {
    const signs = [0, 1].map((c) => Math.sign(dot(model.components[c]!, reference.components[c]!)));
    reference.x.forEach((row, i) => {
      const [px, py] = projectPca(model, row);
      expect(px * signs[0]!).toBeCloseTo(reference.projected[i]![0]!, 5);
      expect(py * signs[1]!).toBeCloseTo(reference.projected[i]![1]!, 5);
    });
  });

  test('hai thành phần trực giao và có độ dài 1', () => {
    expect(dot(model.components[0], model.components[1])).toBeCloseTo(0, 8);
    expect(dot(model.components[0], model.components[0])).toBeCloseTo(1, 8);
  });
});

describe('fitPca2 – trường hợp đặc biệt', () => {
  test('cùng dữ liệu cho cùng kết quả (tái lập)', () => {
    const a = fitPca2(reference.x);
    const b = fitPca2(reference.x);
    expect(Array.from(a.components[0])).toEqual(Array.from(b.components[0]));
  });

  test('dữ liệu giống hệt nhau: phương sai bằng 0, không lỗi', () => {
    const model = fitPca2([
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(model.explainedVarianceRatio).toEqual([0, 0]);
    expect(projectPca(model, [1, 2, 3])).toEqual([0, 0]);
  });

  test('chấp nhận Float32Array', () => {
    const rows = reference.x.map((r) => Float32Array.from(r));
    expect(fitPca2(rows).explainedVarianceRatio[0]).toBeCloseTo(reference.explainedVarianceRatio[0]!, 4);
  });

  test('từ chối ít hơn 2 mẫu hoặc số chiều không đều', () => {
    expect(() => fitPca2([[1, 2]])).toThrow(RangeError);
    expect(() => fitPca2([[1, 2], [3]])).toThrow(RangeError);
  });
});
