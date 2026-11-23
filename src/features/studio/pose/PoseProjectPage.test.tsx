import { configure, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../tests/setup/render';

const SLOW_TEST_MS = 30_000;
configure({ asyncUtilTimeout: 10_000 });

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Tư thế lớp 6', projectType: 'pose' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderApp(`/studio/${projectId}`, repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio, repos.poses);
}

describe('Studio tư thế & bàn tay', () => {
  test('tư thế mẫu: kính hiển vi chuẩn hóa, huấn luyện, độ quan trọng từng khớp', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Dùng tư thế mẫu/ }));
    expect(await screen.findByTestId('pose-count-3')).toHaveTextContent('15 mẫu');
    // đã có mẫu thì khóa loại nhận dạng
    expect(screen.getByRole('radio', { name: /Bàn tay/ })).toBeDisabled();

    expect(screen.getByText('Chưa thấy vấn đề nào.')).toBeInTheDocument();
    const table = screen.getByTestId('pose-table');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(17);
    expect(within(table).getByRole('rowheader', { name: 'vai trái' })).toBeInTheDocument();
    expect(screen.getByTestId('pose-normalized').querySelectorAll('circle')).toHaveLength(17);

    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByTestId('tabular-confusion')).toBeInTheDocument();
    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`pose-importance-${c}`).querySelectorAll('circle[data-value]')).toHaveLength(17);
    expect(screen.getByText('Bật camera hoặc tải một ảnh lên để thử.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByText(/k-NN không học trọng số/)).toBeInTheDocument();
  }, SLOW_TEST_MS);

  test('chọn bàn tay: cử chỉ mẫu có 21 điểm; lựa chọn được ghi nhớ khi mở lại', async () => {
    const { repos, projectId } = await setup();
    const first = render(repos, projectId);
    await userEvent.click(await screen.findByRole('radio', { name: /Bàn tay/ }));
    expect(screen.getByText(/Đưa bàn tay vào khung vuông/)).toBeInTheDocument();
    first.unmount();
    render(repos, projectId);
    expect(await screen.findByRole('radio', { name: /Bàn tay/ })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /Dùng cử chỉ mẫu/ }));
    expect(await screen.findByTestId('pose-count-2')).toHaveTextContent('15 mẫu');
    expect(within(screen.getByTestId('pose-table')).getAllByRole('rowheader')).toHaveLength(21);
    expect(within(screen.getByTestId('pose-table')).getByRole('rowheader', { name: 'đầu ngón trỏ' })).toBeInTheDocument();
  }, SLOW_TEST_MS);

  test('Xưởng mô hình tạo được dự án Tư thế; trợ lý báo nhóm chưa có mẫu', async () => {
    const repos = createTestRepository();
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio, repos.poses);
    await userEvent.type(await screen.findByLabelText('Tên dự án'), 'Cử chỉ');
    await userEvent.click(screen.getByRole('radio', { name: /Tư thế/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    await userEvent.click(await screen.findByRole('link', { name: /Mở/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Dùng tư thế mẫu/ }));
    await screen.findByTestId('pose-count-3');
    await userEvent.type(screen.getByLabelText('Tên nhóm mới'), 'Ngồi xổm');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhóm' }));
    expect(await screen.findByTestId('pose-issues')).toHaveTextContent('Nhóm "Ngồi xổm" mới có 0 mẫu');
  }, SLOW_TEST_MS);
});
