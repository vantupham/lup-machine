import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ProjectType } from '@/storage/schemas/project';
import { createTestRepository, renderApp } from '../../../tests/setup/render';

async function openProject(projectType: ProjectType) {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Dự án ảnh 1', projectType });
  renderApp(`/studio/${project.id}`, repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio, repos.poses);
  await screen.findByRole('heading', { level: 1, name: 'Dự án ảnh 1' });
  return { repos, project };
}

describe('đổi tên dự án ngay trên tiêu đề', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  test.each<ProjectType>(['image', 'audio', 'pose', 'text', 'tabular'])('Studio %s: đổi tên, lưu, tiêu đề đổi theo', async (type) => {
    const { repos, project } = await openProject(type);
    await userEvent.click(screen.getByRole('button', { name: 'Đổi tên dự án' }));
    const input = screen.getByRole('textbox', { name: 'Tên dự án mới' });
    expect(input).toHaveValue('Dự án ảnh 1');
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'Phân loại rác{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: 'Phân loại rác' })).toBeInTheDocument();
    expect((await repos.repository.findById(project.id))?.name).toBe('Phân loại rác');
    expect(screen.getByRole('button', { name: 'Đổi tên dự án' })).toHaveFocus();
  });

  test('Esc hoặc Hủy thì giữ tên cũ', async () => {
    const { repos, project } = await openProject('image');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi tên dự án' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Tên dự án mới' }), ' sửa dở{Escape}');
    expect(screen.getByRole('heading', { level: 1, name: 'Dự án ảnh 1' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đổi tên dự án' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect((await repos.repository.findById(project.id))?.name).toBe('Dự án ảnh 1');
  });

  test('tên trống thì báo lỗi, không lưu', async () => {
    const { repos, project } = await openProject('text');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi tên dự án' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Tên dự án mới' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tên dự án cần từ 1 đến 100 ký tự.');
    expect((await repos.repository.findById(project.id))?.name).toBe('Dự án ảnh 1');
  });

  test('lưu mà không đổi tên thì không ghi gì (không đẩy dự án lên đầu danh sách)', async () => {
    const { repos, project } = await openProject('text');
    const before = (await repos.repository.findById(project.id))!.updatedAt;
    const update = vi.spyOn(repos.repository, 'update');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi tên dự án' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('button', { name: 'Đổi tên dự án' })).toHaveFocus();
    expect(update).not.toHaveBeenCalled();
    expect((await repos.repository.findById(project.id))!.updatedAt).toBe(before);
  });
});
