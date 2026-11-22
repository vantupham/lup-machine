import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ProjectRepository } from '@/storage/repositories/project-repository';
import { createTestRepository, renderApp } from '../../../tests/setup/render';

describe('Xưởng mô hình', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('hiển thị trạng thái trống', async () => {
    renderApp('/studio', createTestRepository().repository);
    expect(await screen.findByText(/chưa có dự án nào/i)).toBeInTheDocument();
  });

  test('tạo dự án ảnh và hiển thị trong danh sách', async () => {
    const { repository } = createTestRepository();
    renderApp('/studio', repository);
    await userEvent.type(screen.getByLabelText('Tên dự án'), 'Phân loại rác');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    const list = await screen.findByRole('list', { name: 'Dự án của em' });
    expect(within(list).getByText('Phân loại rác')).toBeInTheDocument();
    expect(await repository.findAll()).toHaveLength(1);
  });

  test('chỉ loại Ảnh dùng được, các loại khác hiển thị "sắp có"', () => {
    renderApp('/studio', createTestRepository().repository);
    expect(screen.getByRole('radio', { name: /ảnh/i })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /âm thanh/i })).toBeDisabled();
  });

  test('báo lỗi khi tên rỗng', async () => {
    renderApp('/studio', createTestRepository().repository);
    await userEvent.type(screen.getByLabelText('Tên dự án'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/hãy đặt tên/i);
  });

  test('xóa dự án sau khi xác nhận', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'Cần xóa', projectType: 'image' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/studio', repository);
    await userEvent.click(await screen.findByRole('button', { name: /xóa.*cần xóa/i }));
    expect(await screen.findByText(/chưa có dự án nào/i)).toBeInTheDocument();
  });

  test('không xóa khi người dùng hủy', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'Giữ lại', projectType: 'image' });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderApp('/studio', repository);
    await userEvent.click(await screen.findByRole('button', { name: /xóa.*giữ lại/i }));
    expect(await repository.findAll()).toHaveLength(1);
  });

  test('báo lỗi thân thiện khi không đọc được lưu trữ', async () => {
    const broken = {
      ...createTestRepository().repository,
      findAll: () => Promise.reject(new Error('blocked')),
    } satisfies ProjectRepository;
    renderApp('/studio', broken);
    expect(await screen.findByRole('alert')).toHaveTextContent(/không đọc được dữ liệu/i);
  });

  test('báo lỗi khi lưu thất bại', async () => {
    const broken = {
      ...createTestRepository().repository,
      create: () => Promise.reject(new Error('đầy bộ nhớ')),
    } satisfies ProjectRepository;
    renderApp('/studio', broken);
    await userEvent.type(screen.getByLabelText('Tên dự án'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('đầy bộ nhớ');
  });
});
