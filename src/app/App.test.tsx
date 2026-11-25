import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { useModeStore } from '@/ui/mode-store';
import { useOfflineStore } from '@/ui/offline';
import { createTestRepository, renderApp } from '../../tests/setup/render';

describe('Khung ứng dụng', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    useModeStore.setState({ mode: 'explore' });
  });

  test('trang chủ hiển thị tiêu đề và 6 bước quy trình', () => {
    renderApp('/', createTestRepository().repository);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Xem nó làm thế nào');
    const pipeline = screen.getByRole('list', { name: /sáu bước/i });
    expect(within(pipeline).getAllByRole('listitem')).toHaveLength(6);
  });

  test('điều hướng sang Xưởng mô hình', async () => {
    renderApp('/', createTestRepository().repository);
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Xưởng mô hình' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Xưởng mô hình' })).toBeInTheDocument();
  });

  test('chuyển ngôn ngữ sang tiếng Anh và ghi nhớ', async () => {
    renderApp('/', createTestRepository().repository);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('See how it does it');
    expect(window.localStorage.getItem('lup.language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  test('chuyển chế độ học', async () => {
    renderApp('/', createTestRepository().repository);
    const expert = screen.getByRole('radio', { name: /chuyên sâu/i });
    await userEvent.click(expert);
    expect(expert).toBeChecked();
    expect(useModeStore.getState().mode).toBe('expert');
  });

  test('trang không tồn tại', () => {
    renderApp('/khong-co', createTestRepository().repository);
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
  });
});

describe('Trạng thái chạy ngoại tuyến ở chân trang', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });
  afterEach(() => useOfflineStore.setState({ status: 'off' }));

  test('bản dev / không hỗ trợ: không hiện gì', () => {
    renderApp('/', createTestRepository().repository);
    expect(screen.queryByTestId('offline-status')).toBeNull();
  });

  test('đã lưu sẵn: báo dùng được khi mất mạng', () => {
    useOfflineStore.setState({ status: 'ready' });
    renderApp('/', createTestRepository().repository);
    expect(screen.getByTestId('offline-status')).toHaveTextContent(/dùng được cả khi mất mạng/);
  });

  test('lỗi: báo rõ nhưng ứng dụng vẫn chạy', () => {
    useOfflineStore.setState({ status: 'error' });
    renderApp('/', createTestRepository().repository);
    expect(screen.getByTestId('offline-status')).toHaveTextContent(/Chưa lưu sẵn được/);
  });
});
