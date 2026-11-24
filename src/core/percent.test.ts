import { floorPercent } from './percent';

describe('floorPercent', () => {
  test('làm tròn xuống, không hiện 100% khi chưa đúng hết', () => {
    expect(floorPercent(0.996)).toBe(99);
    expect(floorPercent(1)).toBe(100);
    expect(floorPercent(0.875)).toBe(87);
  });

  test('không lệch 1 vì sai số dấu phẩy động', () => {
    expect(floorPercent(0.57)).toBe(57);
    expect(floorPercent(0.29)).toBe(29);
    expect(floorPercent(0.58)).toBe(58);
  });
});
