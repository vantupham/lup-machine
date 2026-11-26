import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { createTestRepository, renderApp } from '../../tests/setup/render';
import { useThemeStore } from './theme-store';

const root = document.documentElement;

describe('Nút đổi giao diện sáng / tối', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    window.localStorage.clear();
    act(() => useThemeStore.setState({ theme: 'light' }));
  });

  afterEach(() => {
    delete root.dataset.theme;
  });

  test('mặc định sáng; bấm để sang tối rồi bấm lại để về sáng', async () => {
    const user = userEvent.setup();
    renderApp('/lessons', createTestRepository().repository);

    const toDark = screen.getByRole('button', { name: 'Giao diện tối' });
    expect(toDark).toHaveAttribute('aria-pressed', 'false');
    expect(root.dataset.theme).toBeUndefined();

    await user.click(toDark);
    expect(root.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Giao diện tối' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Giao diện tối' }));
    expect(root.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem('lup.theme')).toBe('light');
  });
});
