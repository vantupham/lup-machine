import { MOBILENET_SUMMARY } from '@/core/ml/network-summary';
import { funnelLayout, slabHeight, slabWidth } from './network-funnel';

describe('funnelLayout: sơ đồ phễu của MobileNetV2', () => {
  const layout = funnelLayout(MOBILENET_SUMMARY.blocks);

  test('gộp 19 khối thành 5 tầng theo kích thước ảnh 112 → 7', () => {
    expect(layout.stages.map((s) => s.size)).toEqual([112, 56, 28, 14, 7]);
    expect(layout.stages.map((s) => s.slabs.length)).toEqual([2, 2, 3, 7, 5]);
    expect(layout.stages.flatMap((s) => s.slabs.map((b) => b.block.id))).toEqual(MOBILENET_SUMMARY.blocks.map((b) => b.id));
  });

  test('ảnh nhỏ dần thì khối thấp dần; nhiều kênh hơn thì khối dày hơn', () => {
    expect(slabHeight(112)).toBeGreaterThan(slabHeight(56));
    expect(slabHeight(14)).toBeGreaterThan(slabHeight(7));
    expect(slabWidth(1280)).toBeGreaterThan(slabWidth(112));
    expect(slabWidth(16)).toBeGreaterThan(slabWidth(8));
    const heights = layout.stages.map((s) => s.slabs[0]!.h);
    expect([...heights].sort((a, b) => b - a)).toEqual(heights);
  });

  test('các khối xếp từ trái sang phải, không chồng nhau, nằm gọn trong vùng đóng băng', () => {
    const slabs = layout.stages.flatMap((s) => s.slabs);
    slabs.slice(1).forEach((slab, i) => expect(slab.x).toBeGreaterThanOrEqual(slabs[i]!.x + slabs[i]!.w));
    expect(slabs[0]!.x).toBeGreaterThanOrEqual(layout.frozen.x0);
    const last = slabs.at(-1)!;
    expect(last.x + last.w + last.depth).toBeLessThanOrEqual(layout.frozen.x1);
    expect(layout.pool.x).toBeGreaterThan(layout.frozen.x1);
    expect(layout.output.x).toBeGreaterThan(layout.pool.x);
    expect(layout.width).toBeGreaterThan(layout.output.x);
  });

  test('các tầng không chồng nhau và đủ rộng cho nhãn kích thước', () => {
    layout.stages.forEach((stage, i) => {
      expect(stage.x1 - stage.x0).toBeGreaterThanOrEqual(66);
      if (i > 0) expect(stage.x0).toBeGreaterThan(layout.stages[i - 1]!.x1);
    });
  });

  test('mỗi khối căn giữa theo cùng một đường ngang', () => {
    for (const slab of layout.stages.flatMap((s) => s.slabs)) {
      expect(slab.y - slab.depth + (slab.h + slab.depth) / 2).toBeCloseTo(layout.centerY, 6);
    }
  });

  test('vị trí các nút lớp đầu ra trải đều quanh đường giữa', () => {
    expect(layout.classY(1)).toEqual([layout.centerY]);
    const ys = layout.classY(4);
    expect(ys).toHaveLength(4);
    expect((ys[0]! + ys[3]!) / 2).toBeCloseTo(layout.centerY, 6);
    expect(ys[1]! - ys[0]!).toBeCloseTo(ys[3]! - ys[2]!, 6);
  });
});
