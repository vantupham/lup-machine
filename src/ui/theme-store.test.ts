import { act } from '@testing-library/react';
import { THEME_COLORS, applyTheme, readTheme, useThemeStore } from './theme-store';

const root = document.documentElement;

function themeColorMeta(): HTMLMetaElement {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  return meta;
}

describe('giao diện sáng / tối', () => {
  afterEach(() => {
    window.localStorage.clear();
    delete root.dataset.theme;
    act(() => useThemeStore.setState({ theme: 'light' }));
  });

  test('mặc định là sáng, kể cả khi giá trị đã lưu bị hỏng', () => {
    expect(readTheme()).toBe('light');
    for (const bad of ['', 'Dark', 'system', 'abc']) {
      window.localStorage.setItem('lup.theme', bad);
      expect(readTheme()).toBe('light');
    }
    window.localStorage.setItem('lup.theme', 'dark');
    expect(readTheme()).toBe('dark');
  });

  test('áp dụng giao diện: đặt data-theme ở gốc trang và đổi màu thanh trình duyệt', () => {
    const meta = themeColorMeta();
    applyTheme('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(meta.content).toBe(THEME_COLORS.dark);

    applyTheme('light');
    expect(root.dataset.theme).toBeUndefined();
    expect(meta.content).toBe(THEME_COLORS.light);
  });

  test('đổi giao diện thì áp dụng ngay và nhớ cho lần sau', () => {
    act(() => useThemeStore.getState().toggle());
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('lup.theme')).toBe('dark');

    act(() => useThemeStore.getState().toggle());
    expect(useThemeStore.getState().theme).toBe('light');
    expect(root.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem('lup.theme')).toBe('light');
  });
});
