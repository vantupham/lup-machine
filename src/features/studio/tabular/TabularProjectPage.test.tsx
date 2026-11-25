import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../tests/setup/render';

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Lớp 7A – bảng số', projectType: 'tabular' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderApp(`/studio/${projectId}`, repos.repository, repos.dataset, repos.experiments, repos.tables);
}

describe('Studio dữ liệu bảng', () => {
  test('nạp bộ Iris, huấn luyện cây quyết định, đánh giá và dự đoán một dòng mới', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    expect(await screen.findByRole('heading', { level: 1, name: 'Lớp 7A – bảng số' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Hoa diên vĩ/ }));
    expect(await screen.findByTestId('table-size')).toHaveTextContent('150 dòng × 5 cột');
    expect(screen.getByText(/Nguồn dữ liệu: R. A. Fisher/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cột cần dự đoán (nhãn)')).toHaveValue('Loài');
    expect(screen.getByText('Chưa thấy vấn đề nào.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Dòng \d+ của bảng/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByText('Đã huấn luyện (lần 1).')).toBeInTheDocument();
    const confusion = screen.getByTestId('tabular-confusion');
    const total = within(confusion).getAllByRole('cell').reduce((s, c) => s + Number(c.textContent), 0);
    expect(total).toBe(30); // 20% của 150 dòng
    expect(within(screen.getByTestId('tree-diagram')).getAllByText(/≤/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('Dài cánh hoa (cm)'), { target: { value: '1,4' } });
    fireEvent.change(screen.getByLabelText('Rộng cánh hoa (cm)'), { target: { value: '0.2' } });
    expect(screen.getByTestId('tabular-prediction')).toHaveTextContent('Máy đoán: setosa');
    fireEvent.change(screen.getByLabelText('Rộng cánh hoa (cm)'), { target: { value: 'abc' } });
    expect(screen.getByText(/Hãy nhập đủ các ô/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /notebook Google Colab/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeEnabled();
  });

  test('Penguins: báo dòng thiếu và mất cân bằng; đổi sang hồi quy cân nặng có phương trình', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Chim cánh cụt/ }));
    const issues = await screen.findByTestId('tabular-issues');
    expect(issues).toHaveTextContent(/11 dòng bị bỏ/);
    expect(issues).toHaveTextContent(/Mất cân bằng: lớp "Chinstrap"/);

    fireEvent.change(screen.getByLabelText('Cột cần dự đoán (nhãn)'), { target: { value: 'Cân nặng (g)' } });
    expect(screen.getByRole('radio', { name: 'Hồi quy (đoán con số)' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByTestId('linear-equation')).toHaveTextContent(/^Cân nặng \(g\) ≈/);
    expect(screen.getByText('R² tập Kiểm tra')).toBeInTheDocument();
    expect(screen.getByTestId('tabular-prediction')).toHaveTextContent(/Máy đoán Cân nặng \(g\) ≈/);

    // đổi cấu hình thì kết quả cũ bị ẩn cho tới khi huấn luyện lại
    await userEvent.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    expect(screen.getByText(/bấm Huấn luyện để cập nhật/)).toBeInTheDocument();
    expect(screen.queryByTestId('linear-equation')).not.toBeInTheDocument();
  });

  test('cấu hình được lưu và khôi phục khi mở lại dự án', async () => {
    const { repos, projectId } = await setup();
    const first = render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Chim cánh cụt/ }));
    fireEvent.change(await screen.findByLabelText('Cột cần dự đoán (nhãn)'), { target: { value: 'Đảo' } });
    await screen.findByDisplayValue('Đảo');
    await vi.waitFor(async () => expect(((await repos.tables.get(projectId))?.config as { target?: string } | null)?.target).toBe('Đảo'));
    first.unmount();
    render(repos, projectId);
    expect(await screen.findByLabelText('Cột cần dự đoán (nhãn)')).toHaveValue('Đảo');
  });

  test('dán bảng lỗi thì báo dòng bị lệch; bảng đúng thì nạp được', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const area = await screen.findByLabelText('Dán bảng');
    await userEvent.type(area, 'a;b{enter}1;2{enter}3');
    await userEvent.click(screen.getByRole('button', { name: 'Dùng bảng đã dán' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Dòng 3 có số ô khác dòng tiêu đề');
    await userEvent.type(area, ';4');
    await userEvent.click(screen.getByRole('button', { name: 'Dùng bảng đã dán' }));
    expect(await screen.findByTestId('table-size')).toHaveTextContent('2 dòng × 2 cột');
    expect(screen.getByRole('alert')).toHaveTextContent(/Chỉ còn 2 dòng dùng được/);
  });
});

describe('Xưởng mô hình tạo được dự án dữ liệu bảng', () => {
  test('chọn loại "Bảng số" rồi mở dự án', async () => {
    const repos = createTestRepository();
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments, repos.tables);
    await userEvent.type(await screen.findByLabelText('Tên dự án'), 'Chim cánh cụt');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Bảng số mới' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Chim cánh cụt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hoa diên vĩ/ })).toBeInTheDocument();
    expect(await repos.dataset.listClasses((await repos.repository.findAll())[0]!.id)).toEqual([]);
  });
});
