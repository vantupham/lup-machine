import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { useModeStore } from '@/ui/mode-store';
import { useOfflineStore } from '@/ui/offline';
import { createTestRepository, renderApp, renderWithRepositories } from '../../tests/setup/render';

describe('Khung ứng dụng', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    useModeStore.setState({ mode: 'explore' });
  });

  test('trang chủ: tiêu đề là một câu bình thường, không còn khối "Sáu bước" và "Ba cam kết"', () => {
    renderApp('/', createTestRepository().repository);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dạy máy tính nhận ra ảnh, âm thanh, cử chỉ và câu chữ.');
    expect(screen.queryByRole('list', { name: /sáu bước/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Ba cam kết' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Em muốn dạy máy nhận ra gì?' })).toBeInTheDocument();
  });

  test('điều hướng sang trang Mô hình', async () => {
    renderApp('/', createTestRepository().repository);
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Mô hình' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Mô hình' })).toBeInTheDocument();
  });

  test('chuyển ngôn ngữ sang tiếng Anh và ghi nhớ', async () => {
    renderApp('/', createTestRepository().repository);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Teach a computer to recognise images, sounds, gestures and words.');
    expect(window.localStorage.getItem('lup.language')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  test('chuyển chế độ học ở trang có nội dung đổi theo chế độ (Đạo đức AI)', async () => {
    renderApp('/dao-duc', createTestRepository().repository);
    const expert = screen.getByRole('radio', { name: /chuyên sâu/i });
    await userEvent.click(expert);
    expect(expert).toBeChecked();
    expect(useModeStore.getState().mode).toBe('expert');
  });

  test.each(['/', '/studio', '/playground', '/lessons', '/giao-vien', '/about'])(
    'trang %s không đổi theo chế độ học nên không hiện công tắc Khám phá / Chuyên sâu',
    (route) => {
      renderApp(route, createTestRepository().repository);
      expect(screen.queryByRole('group', { name: 'Chế độ học' })).toBeNull();
      expect(screen.queryByRole('radio', { name: /chuyên sâu/i })).toBeNull();
    },
  );

  test('dự án ảnh hiện công tắc chế độ học; dự án văn bản thì không (không có nội dung đổi theo chế độ)', async () => {
    const repos = createTestRepository();
    const image = await repos.repository.create({ name: 'Ảnh', projectType: 'image' });
    const text = await repos.repository.create({ name: 'Câu', projectType: 'text' });
    const imageView = renderWithRepositories(`/studio/${image.id}`, repos);
    expect(await screen.findByRole('radio', { name: /chuyên sâu/i })).toBeInTheDocument();
    imageView.unmount();
    renderWithRepositories(`/studio/${text.id}`, repos);
    expect(await screen.findByRole('heading', { level: 1, name: 'Câu' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /chuyên sâu/i })).toBeNull();
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
