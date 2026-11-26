import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { createTestRepository, renderWithRepositories } from '../../../tests/setup/render';

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

async function seed() {
  const r = createTestRepository();
  const project = await r.repository.create({ name: 'Lá đậu nhóm 3', projectType: 'image' });
  await r.notebook.save(project.id, 'evaluate', 'Hay nhầm gỉ sắt với đốm góc');
  await r.experiments.addRun({
    projectId: project.id,
    fingerprint: 'f1',
    options: { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 42 },
    classNames: ['A', 'B'],
    counts: { train: 10, test: 4 },
    metrics: [{ epoch: 50, trainLoss: 0.1, trainAccuracy: 1, testLoss: 0.4, testAccuracy: 0.75 }],
    guess: { testAccuracy: 0.8 },
  });
  return { r, project };
}

describe('Trang in Sổ tay thí nghiệm', () => {
  test('bản kèm ghi chép: tên dự án, đủ 6 bước, ghi chép và lần chạy đã có', async () => {
    const { r, project } = await seed();
    renderWithRepositories(`/studio/${project.id}/so-tay`, r);
    const sheet = await screen.findByTestId('notebook-sheet');
    expect(within(sheet).getByRole('heading', { level: 1, name: 'Sổ tay thí nghiệm' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent('Lá đậu nhóm 3');
    expect(within(sheet).getAllByTestId(/^inquiry-note-/)).toHaveLength(6);
    expect(within(sheet).getByTestId('inquiry-note-evaluate')).toHaveTextContent('Hay nhầm gỉ sắt với đốm góc');
    const rows = within(within(sheet).getByRole('table', { name: 'Các lần huấn luyện' })).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('#1Lần đầu80%75%');
  });

  test('bản trống: chỉ còn câu hỏi và dòng kẻ, không lộ ghi chép', async () => {
    const { r, project } = await seed();
    renderWithRepositories(`/studio/${project.id}/so-tay`, r);
    await screen.findByTestId('notebook-sheet');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Bản trống' }));
    const sheet = screen.getByTestId('notebook-sheet');
    expect(sheet).not.toHaveTextContent('Hay nhầm gỉ sắt');
    expect(within(sheet).getByTestId('inquiry-note-evaluate')).toHaveTextContent('Ô nào ngoài đường chéo có số lớn nhất?');
    expect(within(within(sheet).getByRole('table', { name: 'Các lần huấn luyện' })).getAllByRole('row').slice(1)).toHaveLength(4);
  });

  test('trang dự án ảnh có liên kết tới trang in', async () => {
    const { r, project } = await seed();
    renderWithRepositories(`/studio/${project.id}`, r);
    expect(await screen.findByRole('link', { name: 'In sổ tay' })).toHaveAttribute('href', `/studio/${project.id}/so-tay`);
  });

  test('dự án không tồn tại thì báo lỗi', async () => {
    renderWithRepositories('/studio/khong-co/so-tay', createTestRepository());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
