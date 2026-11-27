/**
 * Định dạng số giống f-string của Python, để dòng in trong khung "Mã Python" trùng từng chữ với Python thật.
 * Khác JavaScript ở chỗ: số đúng nửa thì làm tròn về số chẵn (Python 12.5 → "12", toFixed → "13").
 */

/** Giống `f"{value:.{digits}f}"`. */
export function pythonFixed(value: number, digits: number): string {
  const scale = 10 ** digits;
  const scaled = value * scale;
  const floor = Math.floor(scaled);
  if (scaled - floor === 0.5) {
    const even = floor % 2 === 0 ? floor : floor + 1;
    return (even / scale).toFixed(digits);
  }
  return value.toFixed(digits);
}

/** Giống `f"{value:.0%}"` (hoặc `.1%` khi digits = 1). */
export function pythonPercent(value: number, digits = 0): string {
  return `${pythonFixed(value * 100, digits)}%`;
}

/** Giống `str(list)` cho danh sách chuỗi ngắn: ['a', 'b']. Dài hơn `max` phần tử thì cắt bớt. */
export function pythonStringList(items: readonly string[], max = 4): string {
  const shown = items.slice(0, max).map((s) => `'${s}'`);
  return `[${[...shown, ...(items.length > max ? ['…'] : [])].join(', ')}]`;
}
