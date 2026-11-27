import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModeStore } from '@/ui/mode-store';
import { useStepDetailsStore } from '@/features/studio/step-details';
import { createTestRepository, renderApp, renderWithRepositories, type TestRepositories } from '../../../../tests/setup/render';

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Lớp 7A – bảng số', projectType: 'tabular' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderWithRepositories(`/studio/${projectId}`, repos);
}

beforeEach(() => {
  // Các kiểm thử 6 bước dùng Chuyên sâu (chỉ có 6 bước); khối làm nhanh kiểm thử riêng ở Khám phá.
  useModeStore.setState({ mode: 'expert' });
  useStepDetailsStore.setState({ isOpen: false });
  window.scrollTo = vi.fn();
});

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
    expect(screen.getByText(/Cần nhập đủ các ô/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /notebook Google Colab/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeEnabled();
  });

  test('Mã Python: chuẩn hóa các cột số; đi theo cây và k-NN cho dòng đang thử, cùng câu trả lời với trang', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Hoa diên vĩ/ }));
    await screen.findByTestId('table-size');
    const panel = (file: string) => document.querySelector<HTMLElement>(`[data-program="${file}"]`)!;
    const run = async (file: string, times: number) => {
      const code = panel(file);
      if (!code.hasAttribute('open')) await userEvent.click(within(code).getByText('Mã Python'));
      for (let i = 0; i < times; i++) await userEvent.click(within(code).getByRole('button', { name: /Đến dòng in tiếp theo/ }));
      return within(code).getByTestId('code-trace-console').textContent!.split('\n');
    };

    expect((await run('tabular_scale.py', 1))[0]).toMatch(/^Dài đài hoa \(cm\): trung bình \d+\.\d{2}, lệch chuẩn \d+\.\d{2}, dòng đầu \d+\.\d{2} → -?\d+\.\d{2}$/);

    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    await screen.findByText('Đã huấn luyện (lần 1).');
    fireEvent.change(screen.getByLabelText('Dài cánh hoa (cm)'), { target: { value: '1,4' } });
    fireEvent.change(screen.getByLabelText('Rộng cánh hoa (cm)'), { target: { value: '0.2' } });
    const treeLines = await run('tree_predict.py', 6);
    expect(treeLines.at(-1)).toMatch(/→ Máy đoán: setosa$/);

    await userEvent.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    await screen.findByText('Đã huấn luyện (lần 2).');
    fireEvent.change(screen.getByLabelText('Dài cánh hoa (cm)'), { target: { value: '1,4' } });
    fireEvent.change(screen.getByLabelText('Rộng cánh hoa (cm)'), { target: { value: '0.2' } });
    const knnLines = await run('knn_predict.py', 6);
    expect(knnLines).toHaveLength(6);
    expect(knnLines.at(-1)).toMatch(/^Phiếu: \[5, 0, 0\] → Máy đoán: setosa$/);
    expect(screen.getByTestId('tabular-prediction')).toHaveTextContent('Máy đoán: setosa');
  });

  test('cây mọc từng nút và các vòng lặp L-BFGS của hồi quy logistic (Iris)', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Hoa diên vĩ/ }));
    await screen.findByTestId('table-size');
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    await screen.findByText('Đã huấn luyện (lần 1).');

    const growth = screen.getByTestId('tree-growth');
    await userEvent.click(within(growth).getByText('Xem cây mọc từng nút'));
    const steps = within(growth).getByTestId('tree-steps');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(1);
    expect(steps).toHaveTextContent(/^Nút 0 \(120 dòng, tạp chất 0,667\): lá, đoán /);
    const slider = within(growth).getByRole('slider');
    fireEvent.change(slider, { target: { value: slider.getAttribute('max')! } });
    const root = within(steps).getAllByRole('listitem')[0]!.textContent!;
    const rootThreshold = /≤ ([\d,]+)\?/.exec(root)![1];
    // Mặc định soi nút vừa tách gần nhất; bấm nút gốc để xem các ngưỡng đã thử ở gốc.
    await userEvent.click(within(steps).getByRole('button', { name: /^Nút 0 / }));
    expect(within(growth).getByTestId('threshold-search')).toHaveTextContent(`ngưỡng ${rootThreshold} giảm tạp chất nhiều nhất`);

    await userEvent.click(screen.getByRole('radio', { name: /Hồi quy logistic/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    await screen.findByText('Đã huấn luyện (lần 2).');
    const logistic = screen.getByTestId('logistic-growth');
    await userEvent.click(within(logistic).getByText(/Xem máy học qua từng vòng lặp/));
    expect(within(logistic).getByTestId('logistic-iterate')).toHaveTextContent(/^Vòng \d+: hàm mục tiêu [\d,]+, đúng [\d,]+% tập Huấn luyện\.$/);
    fireEvent.change(within(logistic).getByRole('slider'), { target: { value: '0' } });
    // Vòng 0: mọi trọng số bằng 0, ba lớp bằng điểm nhau nên máy đoán cùng một lớp: đúng 1/3 tập Huấn luyện.
    expect(within(logistic).getByTestId('logistic-iterate')).toHaveTextContent('Vòng 0: hàm mục tiêu 131,833, đúng 33,3% tập Huấn luyện.');
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

describe('trang Mô hình tạo được dự án dữ liệu bảng', () => {
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

describe('Studio bảng số: khối "Dạy máy trong 3 bước" (Khám phá)', () => {
  beforeEach(() => useModeStore.setState({ mode: 'explore' }));
  const quick = () => screen.getByRole('region', { name: 'Dạy máy trong 3 bước' });

  test('bảng Iris từ cột 1, đổi tên lớp; huấn luyện nhanh qua 4 chặng; thử từng dòng Kiểm tra', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    for (const name of ['1. Chọn bảng', '2. Cho máy học', '3. Thử ngay']) expect(within(region).getByRole('heading', { name })).toBeInTheDocument();
    expect(within(region).getByText('Chọn một bảng trước.')).toBeInTheDocument();

    await userEvent.click(within(region).getByRole('button', { name: /Hoa diên vĩ/ }));
    expect(await within(region).findByText('150 dòng · 5 cột')).toBeInTheDocument();
    expect(within(region).getByLabelText('Máy cần đoán cột')).toHaveValue('Loài');
    const classes = within(region).getByRole('list', { name: 'Các lớp của cột cần đoán' });
    expect(within(classes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['setosa50 dòng', 'versicolor50 dòng', 'virginica50 dòng']);

    await userEvent.click(within(classes).getByRole('button', { name: 'Đổi tên lớp setosa' }));
    await userEvent.clear(within(region).getByRole('textbox', { name: 'Tên lớp' }));
    await userEvent.type(within(region).getByRole('textbox', { name: 'Tên lớp' }), 'diên vĩ biển{Enter}');
    expect(await within(quick()).findByRole('button', { name: 'Đổi tên lớp diên vĩ biển' })).toBeInTheDocument();
    expect((await repos.tables.get(projectId))!.csv).not.toContain('setosa');

    await userEvent.click(within(quick()).getByRole('button', { name: 'Huấn luyện nhanh' }));
    const stages = within(quick()).getByRole('list', { name: 'Các chặng huấn luyện' });
    expect(within(stages).getByText('Biến mỗi dòng thành 4 số')).toHaveTextContent('(đang làm)');
    expect(await within(quick()).findByText(/^Xong\. Máy đoán đúng \d+% mẫu Kiểm tra\.$/, {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(within(stages).getByText('Máy học: Cây quyết định')).toHaveTextContent('(xong)');
    expect(await repos.trials.list(projectId)).toHaveLength(1);

    await userEvent.click(within(quick()).getByRole('button', { name: 'Thử một dòng Kiểm tra' }));
    expect(within(quick()).getByText(/^Dòng \d+: Loài thật là /)).toBeInTheDocument();
    expect(within(quick()).getByRole('list', { name: 'Máy đoán' })).toBeInTheDocument();
    await userEvent.click(within(quick()).getByRole('button', { name: 'Dòng Kiểm tra tiếp theo' }));
  }, 30_000);

  test('Penguins: đổi cột cần đoán sang cân nặng thì thành hồi quy, chấm bằng R²', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    await userEvent.click(within(region).getByRole('button', { name: /Chim cánh cụt/ }));
    await userEvent.selectOptions(await within(region).findByLabelText('Máy cần đoán cột'), 'Cân nặng (g)');
    expect(within(region).getByText('Hồi quy: đoán một con số.')).toBeInTheDocument();
    await userEvent.click(within(region).getByRole('button', { name: 'Huấn luyện nhanh' }));
    expect(await within(quick()).findByText(/^Xong\. R² trên mẫu Kiểm tra là -?\d+,\d{2}/, {}, { timeout: 5_000 })).toBeInTheDocument();
    await userEvent.click(within(quick()).getByRole('button', { name: 'Thử một dòng Kiểm tra' }));
    expect(within(quick()).getByTestId('quick-regression')).toHaveTextContent(/^Máy đoán /);
  }, 30_000);
});
