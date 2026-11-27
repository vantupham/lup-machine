/**
 * Giá trị của một biến trong vết chạy, đã rút gọn để hiển thị: số, chuỗi, hoặc mảng (chỉ giữ vài số đầu).
 * Định dạng theo kiểu Python (dấu chấm thập phân) vì khung này mô phỏng màn hình Python.
 */
export type TraceValue =
  | { readonly kind: 'scalar'; readonly value: number; readonly isInt: boolean }
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'array';
      readonly shape: readonly number[];
      /** Phần đang xem, ví dụ "p[0]" hay "W[0, :3]"; rỗng nếu là cả mảng. */
      readonly view: string;
      readonly head: readonly number[];
      readonly hasMore: boolean;
      readonly isInt: boolean;
    };

/** Số giá trị đầu tiên giữ lại khi rút gọn một mảng. */
export const HEAD_SIZE = 3;
const SMALL_ABS = 1e-3;

export function scalar(value: number, isInt = false): TraceValue {
  return { kind: 'scalar', value, isInt };
}

export function text(value: string): TraceValue {
  return { kind: 'text', text: value };
}

interface ArrayOptions {
  readonly shape: readonly number[];
  readonly view?: string;
  readonly isInt?: boolean;
  readonly size?: number;
}

export function array(values: ArrayLike<number>, { shape, view = '', isInt = false, size = HEAD_SIZE }: ArrayOptions): TraceValue {
  const head = Array.from({ length: Math.min(size, values.length) }, (_, i) => values[i] as number);
  return { kind: 'array', shape, view, head, hasMore: values.length > head.length, isInt };
}

export function formatNumber(value: number, isInt: boolean): string {
  if (isInt) return String(Math.round(value));
  if (value === 0) return '0.0';
  if (Math.abs(value) < SMALL_ABS) return value.toExponential(2);
  return value.toFixed(4);
}

export function formatShape(shape: readonly number[]): string {
  return shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`;
}

export function formatValue(value: TraceValue): string {
  switch (value.kind) {
    case 'scalar':
      return formatNumber(value.value, value.isInt);
    case 'text':
      return value.text;
    case 'array': {
      const items = value.head.map((v) => formatNumber(v, value.isInt));
      return `[${[...items, ...(value.hasMore ? ['…'] : [])].join(', ')}]`;
    }
  }
}
