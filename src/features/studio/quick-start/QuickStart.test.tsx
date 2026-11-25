import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ProjectRepository } from '@/storage/repositories/project-repository';
import type { DatasetRepository } from '@/storage/repositories/dataset-repository';
import { createTestRepository, renderApp } from '../../../../tests/setup/render';

describe('Tạo mô hình nhanh từ trang chủ', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  test('trang chủ có đủ 5 thẻ loại dự án', () => {
    renderApp('/', createTestRepository().repository);
    const section = screen.getByRole('region', { name: 'Em muốn dạy máy nhận ra gì?' });
    for (const type of ['Ảnh', 'Âm thanh', 'Tư thế', 'Văn bản', 'Bảng số']) {
      expect(within(section).getByRole('button', { name: `Tạo dự án ${type} mới` })).toBeEnabled();
    }
  });

  test('một cú bấm: tạo dự án ảnh tên tự đặt, có sẵn 2 lớp, rồi vào thẳng dự án', async () => {
    const repos = createTestRepository();
    renderApp('/', repos.repository, repos.dataset);
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dự án ảnh 1' })).toBeInTheDocument();
    const [project] = await repos.repository.findAll();
    expect(project?.projectType).toBe('image');
    expect((await repos.dataset.listClasses(project!.id)).map((c) => c.name)).toEqual(['Lớp 1', 'Lớp 2']);
  });

  test('tên tự đặt tăng dần theo từng loại', async () => {
    const repos = createTestRepository();
    await repos.repository.create({ name: 'Dự án văn bản 1', projectType: 'text' });
    renderApp('/', repos.repository, repos.dataset);
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Văn bản mới' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dự án văn bản 2' })).toBeInTheDocument();
  });

  test('âm thanh không tạo sẵn lớp để còn gợi ý dùng âm thanh mẫu', async () => {
    const repos = createTestRepository();
    renderApp('/', repos.repository, repos.dataset);
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Âm thanh mới' }));
    expect(await screen.findByRole('button', { name: /Dùng âm thanh mẫu/ })).toBeInTheDocument();
  });

  test('báo lỗi dễ hiểu khi không lưu được', async () => {
    const broken = { ...createTestRepository().repository, create: () => Promise.reject(new Error('đầy bộ nhớ')) } satisfies ProjectRepository;
    renderApp('/', broken);
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tạo được dự án: đầy bộ nhớ');
    expect(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' })).toBeEnabled();
  });

  test('tạo lớp mặc định lỗi thì không để lại dự án dở dang', async () => {
    const repos = createTestRepository();
    const broken = { ...repos.dataset, addClass: () => Promise.reject(new Error('hỏng')) } satisfies DatasetRepository;
    renderApp('/', repos.repository, broken);
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tạo được dự án: hỏng');
    expect(await repos.repository.findAll()).toHaveLength(0);
  });

  test('chưa có dự án thì không hiện mục "Tiếp tục dự án gần đây"', async () => {
    renderApp('/', createTestRepository().repository);
    await screen.findByRole('region', { name: 'Em muốn dạy máy nhận ra gì?' });
    expect(screen.queryByRole('region', { name: 'Tiếp tục dự án gần đây' })).toBeNull();
  });

  test('hiện 3 dự án sửa gần nhất và mở được', async () => {
    const repos = createTestRepository();
    for (const name of ['Cũ nhất', 'Thứ hai', 'Thứ ba', 'Mới nhất']) {
      await repos.repository.create({ name, projectType: 'text' });
      await new Promise((r) => setTimeout(r, 5));
    }
    renderApp('/', repos.repository, repos.dataset);
    const recent = await screen.findByRole('region', { name: 'Tiếp tục dự án gần đây' });
    const links = within(recent).getAllByRole('link', { name: /^Mở / });
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual(['Mở Mới nhất', 'Mở Thứ ba', 'Mở Thứ hai']);
    expect(within(recent).getByRole('link', { name: /Xem tất cả dự án/ })).toHaveAttribute('href', '/studio');
    await userEvent.click(links[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mới nhất' })).toBeInTheDocument();
  });

  test('thanh điều hướng gọn 5 mục, làm nổi Mô hình, không có dòng phụ đề; Giới thiệu và đổi ngôn ngữ ở chân trang', () => {
    renderApp('/', createTestRepository().repository);
    expect(screen.queryByText('Phòng thí nghiệm AI minh bạch')).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Mô hình', 'Thuật toán', 'Bài học', 'Đạo đức AI', 'Góc giáo viên']);
    expect(within(nav).getByRole('link', { name: 'Mô hình' })).toHaveAttribute('data-featured', 'true');
    expect(within(nav).getByRole('link', { name: 'Bài học' })).not.toHaveAttribute('data-featured');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Giới thiệu & Quyền riêng tư' })).toHaveAttribute('href', '/about');
    expect(within(footer).getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  test('trang chủ không còn nút kêu gọi trùng lặp: thẻ loại dữ liệu là lối vào chính', () => {
    renderApp('/', createTestRepository().repository);
    expect(screen.queryByRole('button', { name: /Tạo mô hình mới/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Vào Xưởng mô hình/ })).toBeNull();
  });
});

describe('Đường dẫn tạo nhanh #/studio/moi/:loai', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  test('mở đường dẫn là có ngay dự án tư thế, chỉ tạo đúng một dự án', async () => {
    const repos = createTestRepository();
    renderApp('/studio/moi/tu-the', repos.repository, repos.dataset);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dự án tư thế 1' })).toBeInTheDocument();
    expect(await repos.repository.findAll()).toHaveLength(1);
  });

  test('loại lạ thì báo rõ và cho chọn lại, không tạo gì', async () => {
    const repos = createTestRepository();
    renderApp('/studio/moi/video', repos.repository, repos.dataset);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không có loại dự án "video"');
    expect(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' })).toBeInTheDocument();
    expect(await repos.repository.findAll()).toHaveLength(0);
  });

  test('lưu lỗi thì báo và có đường quay về trang Mô hình', async () => {
    const broken = { ...createTestRepository().repository, create: () => Promise.reject(new Error('bị chặn')) } satisfies ProjectRepository;
    renderApp('/studio/moi/anh', broken);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tạo được dự án: bị chặn');
    expect(screen.getByRole('link', { name: /Về trang Mô hình/ })).toHaveAttribute('href', '/studio');
  });
});
