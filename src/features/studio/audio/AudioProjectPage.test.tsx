import { configure, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useModeStore } from '@/ui/mode-store';
import { useStepDetailsStore } from '@/features/studio/step-details';
import { createTestRepository, renderApp, renderWithRepositories, type TestRepositories } from '../../../../tests/setup/render';

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Nghe âm thanh', projectType: 'audio' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderWithRepositories(`/studio/${projectId}`, repos);
}

/**
 * Mỗi kiểm thử tạo 48 đoạn âm thanh (64 KB mỗi đoạn) và tính ảnh phổ cho từng đoạn; mỗi lần tải lại
 * từ IndexedDB giả lập khá chậm khi cả bộ kiểm thử chạy song song, nên chờ lâu hơn mặc định.
 */
const SLOW_TEST_MS = 30_000;
configure({ asyncUtilTimeout: 10_000 });

beforeEach(() => {
  // Các kiểm thử 6 bước dùng Chuyên sâu (chỉ có 6 bước); khối làm nhanh kiểm thử riêng ở Khám phá.
  useModeStore.setState({ mode: 'expert' });
  useStepDetailsStore.setState({ isOpen: false });
  window.scrollTo = vi.fn();
});

describe('Studio âm thanh', () => {
  test('bộ âm thanh mẫu: kính hiển vi ảnh phổ, huấn luyện logistic, bản đồ vùng phổ cho từng nhóm', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    // jsdom không có Web Audio: báo rõ, nhưng vẫn dùng được âm thanh mẫu
    expect(await screen.findByText(/không hỗ trợ Web Audio/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Dùng âm thanh mẫu/ }));
    expect(await screen.findByTestId('clip-count-0')).toHaveTextContent('16 đoạn');
    expect(screen.getAllByRole('textbox', { name: /Tên nhóm \d/ }).map((i) => (i as HTMLInputElement).value)).toEqual(['Chuông', 'Còi', 'Trống']);

    expect(screen.getByText('Chưa thấy vấn đề nào.')).toBeInTheDocument();
    expect(screen.getByTestId('spectrogram').querySelectorAll('rect').length).toBeGreaterThanOrEqual(40 * 97);
    expect(screen.getByTestId('pooled-grid').querySelectorAll('rect')).toHaveLength(160);
    fireEvent.change(screen.getByLabelText('Khung thời gian'), { target: { value: '50' } });
    expect(screen.getByRole('img', { name: 'Phổ công suất của khung 51' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByTestId('tabular-confusion')).toBeInTheDocument();
    expect(screen.getByTestId('studio-findings')).toHaveTextContent('Điểm đáng chú ý');
    for (const c of [0, 1, 2]) expect(screen.getByTestId(`importance-${c}`).querySelectorAll('rect')).toHaveLength(160);
    expect(screen.getByText('Thu 1 giây hoặc tải một tệp âm thanh để thử.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    expect(screen.getByText(/bấm Huấn luyện để cập nhật/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByText(/k-NN không học trọng số/)).toBeInTheDocument();
    // Nhật ký thí nghiệm: lần 2 đổi mô hình so với lần 1
    expect(await screen.findByText('Kết quả so với lần #1')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Nhật ký thí nghiệm' })).getByTestId('trial-row-2')).toHaveTextContent('mô hình: Hồi quy logistic → k-NN');
  }, SLOW_TEST_MS);

  test('thêm, đổi tên và xóa nhóm; trợ lý báo nhóm chưa đủ đoạn', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Dùng âm thanh mẫu/ }));
    await screen.findByTestId('clip-count-2');
    expect(screen.queryByLabelText('Tên nhóm mới')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhóm' }));
    expect(await screen.findByTestId('clip-count-3')).toHaveTextContent('0 đoạn');
    expect(screen.getByRole('textbox', { name: 'Tên nhóm 4' })).toHaveValue('Nhóm 4');
    expect(screen.getByTestId('audio-issues')).toHaveTextContent('Nhóm "Nhóm 4" mới có 0 đoạn');

    const name = screen.getByRole('textbox', { name: 'Tên nhóm 1' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Chuông chùa');
    fireEvent.blur(name);
    await vi.waitFor(async () => expect((await repos.dataset.listClasses(projectId))[0]!.name).toBe('Chuông chùa'));
    expect((await screen.findAllByText(/Chuông chùa #1/, {}, { timeout: 5_000 })).length).toBeGreaterThan(0);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const card = screen.getByTestId('clip-count-3').closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Xóa nhóm Nhóm 4' }));
    expect(await screen.findByText('Chưa thấy vấn đề nào.')).toBeInTheDocument();
    expect((await repos.dataset.listClasses(projectId)).map((c) => c.name)).toEqual(['Chuông chùa', 'Còi', 'Trống']);
    vi.restoreAllMocks();
  }, SLOW_TEST_MS);

  test('trang Mô hình tạo được dự án Âm thanh (không tạo sẵn nhóm)', async () => {
    const repos = createTestRepository();
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio);
    await userEvent.type(await screen.findByLabelText('Tên dự án'), 'Âm thanh lớp 7');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Âm thanh mới' }));
    expect(await screen.findByRole('button', { name: /Dùng âm thanh mẫu/ })).toBeInTheDocument();
  });
});

describe('Studio âm thanh: khối "Dạy máy trong 3 bước" (Khám phá)', () => {
  beforeEach(() => useModeStore.setState({ mode: 'explore' }));
  const quick = () => screen.getByRole('region', { name: 'Dạy máy trong 3 bước' });

  test('6 bước thu gọn sẵn; âm thanh mẫu từ cột 1; huấn luyện nhanh chạy lần lượt 4 chặng rồi nghe thử được', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    for (const name of ['1. Thu âm thanh', '2. Cho máy học', '3. Nghe thử']) expect(within(region).getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem từng bước bên trong' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(region).getByRole('button', { name: 'Huấn luyện nhanh' })).toBeDisabled();

    await userEvent.click(within(region).getByRole('button', { name: /Dùng âm thanh mẫu/ }));
    const bell = await within(region).findByRole('group', { name: 'Chuông' });
    expect(within(bell).getByText('16 đoạn')).toBeInTheDocument();
    expect(within(region).getByText('Huấn luyện xong mới xem thử được.')).toBeInTheDocument();

    await userEvent.click(within(region).getByRole('button', { name: 'Huấn luyện nhanh' }));
    const stages = within(quick()).getByRole('list', { name: 'Các chặng huấn luyện' });
    expect(within(stages).getByText('Biến âm thanh thành 160 số')).toHaveTextContent('(đang làm)');
    expect(within(stages).getByText('Máy học: Hồi quy logistic')).toHaveTextContent('(chưa tới)');
    expect(await within(quick()).findByText(/^Xong\. Máy đoán đúng \d+% mẫu Kiểm tra\.$/, {}, { timeout: 5_000 })).toBeInTheDocument();
    for (const label of ['Biến âm thanh thành 160 số', 'Chia Huấn luyện / Kiểm tra', 'Máy học: Hồi quy logistic', 'Chấm điểm']) {
      expect(within(stages).getByText(label)).toHaveTextContent('(xong)');
    }
    expect(within(stages).getByText(/^\d+ Huấn luyện · \d+ Kiểm tra$/)).toBeInTheDocument();
    // Cùng một mô hình với bước 4: nhật ký thí nghiệm có lần #1.
    expect(await repos.trials.list(projectId)).toHaveLength(1);
    expect(within(quick()).getByLabelText('Thử với một tệp âm thanh')).toBeInTheDocument();
  }, SLOW_TEST_MS);

  test('bút chì đổi tên nhóm ngay ở cột 1', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    await userEvent.click(within(region).getByRole('button', { name: /Dùng âm thanh mẫu/ }));
    await userEvent.click(await within(region).findByRole('button', { name: 'Đổi tên lớp Còi' }));
    const input = within(region).getByRole('textbox', { name: 'Tên lớp' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Còi xe{Enter}');
    expect(await within(quick()).findByRole('group', { name: 'Còi xe' })).toBeInTheDocument();
    expect((await repos.dataset.listClasses(projectId)).map((c) => c.name)).toEqual(['Chuông', 'Còi xe', 'Trống']);
  }, SLOW_TEST_MS);
});
