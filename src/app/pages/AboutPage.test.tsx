import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ProjectRepository } from '@/storage/repositories/project-repository';
import { createTestRepository, renderApp } from '../../../tests/setup/render';

describe('Trang Giới thiệu & Quyền riêng tư', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('liệt kê cam kết quyền riêng tư', () => {
    renderApp('/about', createTestRepository().repository);
    expect(screen.getByRole('heading', { name: 'Dữ liệu của em đi đâu?' })).toBeInTheDocument();
    expect(screen.getByText(/không có máy chủ nhận dữ liệu/i)).toBeInTheDocument();
  });

  test('xóa toàn bộ dữ liệu sau khi xác nhận', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'A', projectType: 'image' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/about', repository);
    await userEvent.click(screen.getByRole('button', { name: /xóa toàn bộ dữ liệu/i }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã xóa toàn bộ dữ liệu');
    expect(await repository.findAll()).toHaveLength(0);
  });

  test('không xóa khi hủy', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'A', projectType: 'image' });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/about', repository);
    await userEvent.click(screen.getByRole('button', { name: /xóa toàn bộ dữ liệu/i }));
    expect(await repository.findAll()).toHaveLength(1);
  });

  test('báo lỗi khi xóa thất bại', async () => {
    const broken = {
      ...createTestRepository().repository,
      deleteAll: () => Promise.reject(new Error('bị khóa')),
    } satisfies ProjectRepository;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/about', broken);
    await userEvent.click(screen.getByRole('button', { name: /xóa toàn bộ dữ liệu/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('bị khóa');
  });
});
