import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModeStore } from '@/ui/mode-store';
import { useStepDetailsStore } from '@/features/studio/step-details';
import { createTestRepository, renderApp, renderWithRepositories, type TestRepositories } from '../../../../tests/setup/render';

const SLOW_TEST_MS = 30_000;
configure({ asyncUtilTimeout: 10_000 });

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Tư thế lớp 6', projectType: 'pose' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderWithRepositories(`/studio/${projectId}`, repos);
}

/** Khung "Mã Python" của một chương trình; mở ra rồi chạy tới dòng in thứ `times`. */
async function runCode(file: string, times: number): Promise<string[]> {
  const code = document.querySelector<HTMLElement>(`[data-program="${file}"]`)!;
  if (!code.hasAttribute('open')) await userEvent.click(within(code).getByText('Mã Python'));
  for (let i = 0; i < times; i++) await userEvent.click(within(code).getByRole('button', { name: /Đến dòng in tiếp theo/ }));
  return within(code).getByTestId('code-trace-console').textContent!.split(String.fromCharCode(10));
}

beforeEach(() => {
  // Các kiểm thử 6 bước dùng Chuyên sâu (chỉ có 6 bước); khối làm nhanh kiểm thử riêng ở Khám phá.
  useModeStore.setState({ mode: 'expert' });
  useStepDetailsStore.setState({ isOpen: false });
  window.scrollTo = vi.fn();
});

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
    const joints = await runCode('pose_features.py', 17);
    expect(joints).toHaveLength(17);
    expect(joints[5]).toMatch(/^vai trái: /);

    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByTestId('tabular-confusion')).toBeInTheDocument();
    expect(screen.getByTestId('studio-findings')).toHaveTextContent('Điểm đáng chú ý');
    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`pose-importance-${c}`).querySelectorAll('circle[data-value]')).toHaveLength(17);
    expect(screen.getByText('Bật camera hoặc tải một ảnh lên để thử.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByText(/k-NN không học trọng số/)).toBeInTheDocument();
    const knnCode = document.querySelector<HTMLElement>('[data-program="knn_predict.py"]')!;
    await userEvent.click(within(knnCode).getByText('Mã Python'));
    expect(within(knnCode).getByText('Tải một ảnh lên (camera đang tắt) để chạy mã với tư thế đó.')).toBeInTheDocument();
    // Nhật ký thí nghiệm: lần 2 đổi mô hình so với lần 1
    expect(await screen.findByText('Kết quả so với lần #1')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Nhật ký thí nghiệm' })).getByTestId('trial-row-2')).toHaveTextContent('mô hình: Hồi quy logistic → k-NN');
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

  test('trang Mô hình tạo được dự án Tư thế; trợ lý báo nhóm chưa có mẫu', async () => {
    const repos = createTestRepository();
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio, repos.poses);
    await userEvent.type(await screen.findByLabelText('Tên dự án'), 'Cử chỉ');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Tư thế mới' }));
    await userEvent.click(await screen.findByRole('button', { name: /Dùng tư thế mẫu/ }));
    await screen.findByTestId('pose-count-3');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhóm' }));
    expect(await screen.findByTestId('pose-issues')).toHaveTextContent('Nhóm "Nhóm 5" mới có 0 mẫu');
    const name = screen.getByRole('textbox', { name: 'Tên nhóm 5' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Ngồi xổm{Enter}');
    await waitFor(() => expect(screen.getByTestId('pose-issues')).toHaveTextContent('Nhóm "Ngồi xổm" mới có 0 mẫu'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa nhóm Ngồi xổm' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Tên nhóm 5' })).toBeNull());
    vi.restoreAllMocks();
  }, SLOW_TEST_MS);
});

describe('Studio tư thế: khối "Dạy máy trong 3 bước" (Khám phá)', () => {
  beforeEach(() => useModeStore.setState({ mode: 'explore' }));
  const quick = () => screen.getByRole('region', { name: 'Dạy máy trong 3 bước' });

  test('6 bước thu gọn sẵn; tư thế mẫu từ cột 1; huấn luyện nhanh chạy lần lượt 4 chặng, ghi nhật ký', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    for (const name of ['1. Ghi tư thế', '2. Cho máy học', '3. Thử ngay']) expect(within(region).getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem từng bước bên trong' })).toHaveAttribute('aria-expanded', 'false');
    // chưa có mẫu: chọn được cơ thể / bàn tay ngay ở cột 1
    expect(within(region).getByRole('radio', { name: /Cơ thể/ })).toBeChecked();

    await userEvent.click(within(region).getByRole('button', { name: /Dùng tư thế mẫu/ }));
    for (const name of ['Giơ hai tay', 'Dang tay', 'Chống nạnh', 'Đứng nghiêm']) expect(await within(region).findByRole('group', { name })).toBeInTheDocument();
    expect(within(region).queryByRole('radio', { name: /Bàn tay/ })).toBeNull();
    expect(within(region).getByText('Bật camera để ghi mẫu.')).toBeInTheDocument();
    expect(within(region).getAllByRole('button', { name: /^Ghi 1 mẫu cho nhóm/ })[0]).toBeDisabled();

    await userEvent.click(within(region).getByRole('button', { name: 'Huấn luyện nhanh' }));
    const stages = within(quick()).getByRole('list', { name: 'Các chặng huấn luyện' });
    expect(within(stages).getByText('Biến khung xương thành 34 số')).toHaveTextContent('(đang làm)');
    expect(await within(quick()).findByText(/^Xong\. Máy đoán đúng \d+% mẫu Kiểm tra\.$/, {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(within(stages).getByText('60 mẫu')).toBeInTheDocument();
    for (const label of ['Biến khung xương thành 34 số', 'Chia Huấn luyện / Kiểm tra', 'Máy học: Hồi quy logistic', 'Chấm điểm']) {
      expect(within(stages).getByText(label)).toHaveTextContent('(xong)');
    }
    expect(await repos.trials.list(projectId)).toHaveLength(1);
    expect(within(quick()).getByLabelText('Thử với một ảnh')).toBeInTheDocument();
  }, SLOW_TEST_MS);

  test('bút chì đổi tên nhóm ngay ở cột 1', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    await userEvent.click(within(region).getByRole('button', { name: /Dùng tư thế mẫu/ }));
    await userEvent.click(await within(region).findByRole('button', { name: 'Đổi tên lớp Giơ hai tay' }));
    const input = within(region).getByRole('textbox', { name: 'Tên lớp' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Giơ tay chào{Enter}');
    expect(await within(quick()).findByRole('group', { name: 'Giơ tay chào' })).toBeInTheDocument();
    expect((await repos.dataset.listClasses(projectId))[0]!.name).toBe('Giơ tay chào');
  }, SLOW_TEST_MS);
});
