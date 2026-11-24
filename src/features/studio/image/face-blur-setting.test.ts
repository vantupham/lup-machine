import { act, renderHook } from '@testing-library/react';
import { readFaceBlur, useFaceBlurSetting } from './face-blur-setting';

describe('công tắc làm mờ khuôn mặt', () => {
  afterEach(() => window.localStorage.clear());

  test('mặc định bật; nhớ riêng cho từng dự án', () => {
    expect(readFaceBlur('p1')).toBe(true);
    const { result } = renderHook(() => useFaceBlurSetting('p1'));
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
    expect(readFaceBlur('p1')).toBe(false);
    expect(readFaceBlur('p2')).toBe(true);
    act(() => result.current[1](true));
    expect(readFaceBlur('p1')).toBe(true);
  });
});
