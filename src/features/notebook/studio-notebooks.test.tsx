import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ProjectType } from '@/storage/schemas/project';
import { useStepDetailsStore } from '@/features/studio/step-details';
import { createTestRepository, renderWithRepositories } from '../../../tests/setup/render';

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  // Studio âm thanh thu gọn 6 bước ở chế độ Khám phá: mở sẵn để thấy ô Sổ tay.
  useStepDetailsStore.setState({ isOpen: true });
});

const FIRST_QUESTION: Record<Exclude<ProjectType, 'image'>, string> = {
  audio: 'Mỗi nhóm có bao nhiêu đoạn?',
  pose: 'Mỗi nhóm có bao nhiêu mẫu?',
  text: 'Mỗi nhóm có bao nhiêu câu?',
  tabular: 'Bảng có bao nhiêu dòng, bao nhiêu cột?',
};

describe.each(Object.entries(FIRST_QUESTION) as [Exclude<ProjectType, 'image'>, string][])('Sổ tay ở Studio %s', (projectType, question) => {
  test('bước Dữ liệu có ô Sổ tay với câu hỏi riêng của Studio; ghi chép được lưu', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: `Dự án ${projectType}`, projectType });
    renderWithRepositories(`/studio/${project.id}`, r);

    const box = await screen.findByTestId('notebook-data');
    const user = userEvent.setup();
    await user.click(within(box).getByRole('button', { name: /Sổ tay/ }));
    expect(box).toHaveTextContent(question);
    await user.type(within(box).getByLabelText('Ghi chép của em'), 'Ghi chép thử');
    await user.tab();
    expect(await within(box).findByText('Đã lưu')).toBeInTheDocument();
    expect(await r.notebook.list(project.id)).toEqual([{ step: 'data', text: 'Ghi chép thử' }]);

    expect(screen.getByRole('link', { name: 'In sổ tay' })).toHaveAttribute('href', `/studio/${project.id}/so-tay`);
  });

  test('trang in có đủ 6 bước với câu hỏi của Studio', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: `Dự án ${projectType}`, projectType });
    renderWithRepositories(`/studio/${project.id}/so-tay`, r);
    const sheet = await screen.findByTestId('notebook-sheet');
    expect(within(sheet).getAllByTestId(/^inquiry-note-/)).toHaveLength(6);
    expect(within(sheet).getByTestId('inquiry-note-data')).toHaveTextContent(question);
  });
});
