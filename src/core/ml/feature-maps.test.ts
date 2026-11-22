import { channelPlane, planeToGrayRgba, strongestChannels, type ActivationTensor } from './feature-maps';

// 2×2 ô, 3 kênh, bố cục HWC: [ô0: c0 c1 c2, ô1: …]
const TENSOR: ActivationTensor = {
  layer: 'demo',
  height: 2,
  width: 2,
  channels: 3,
  data: Float32Array.from([
    0, 5, 1, //
    0, 6, 2, //
    0, 7, 3, //
    0, 8, 4,
  ]),
};

describe('channelPlane', () => {
  test('lấy đúng một kênh thành ảnh H×W', () => {
    expect(Array.from(channelPlane(TENSOR, 1))).toEqual([5, 6, 7, 8]);
    expect(Array.from(channelPlane(TENSOR, 2))).toEqual([1, 2, 3, 4]);
  });
  test('từ chối kênh ngoài phạm vi hoặc dữ liệu sai kích thước', () => {
    expect(() => channelPlane(TENSOR, 3)).toThrow(RangeError);
    expect(() => channelPlane({ ...TENSOR, data: new Float32Array(5) }, 0)).toThrow(RangeError);
  });
});

describe('strongestChannels', () => {
  test('xếp kênh theo kích hoạt trung bình giảm dần', () => {
    expect(strongestChannels(TENSOR, 2)).toEqual([1, 2]);
    expect(strongestChannels(TENSOR, 10)).toEqual([1, 2, 0]);
  });
  test('bằng nhau thì giữ thứ tự kênh (ổn định)', () => {
    const flat: ActivationTensor = { layer: 'x', height: 1, width: 1, channels: 3, data: Float32Array.from([1, 1, 1]) };
    expect(strongestChannels(flat, 3)).toEqual([0, 1, 2]);
  });
});

describe('planeToGrayRgba', () => {
  test('chuẩn hóa min–max về 0…255: sáng = kích hoạt mạnh', () => {
    const rgba = planeToGrayRgba(Float32Array.from([1, 2, 3]));
    expect(Array.from(rgba)).toEqual([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  });
  test('kênh không đổi (ví dụ toàn 0 sau ReLU) thành ảnh đen, không chia cho 0', () => {
    expect(Array.from(planeToGrayRgba(Float32Array.from([0, 0])))).toEqual([0, 0, 0, 255, 0, 0, 0, 255]);
  });
});
