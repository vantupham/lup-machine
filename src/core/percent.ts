/**
 * Phần trăm làm tròn xuống: 0,996 → 99 (không bao giờ hiện 100% khi chưa đúng hết).
 * Cộng một lượng rất nhỏ để sai số dấu phẩy động không làm 0,57 thành 56.
 */
export function floorPercent(fraction: number): number {
  return Math.floor(fraction * 100 + 1e-9);
}
