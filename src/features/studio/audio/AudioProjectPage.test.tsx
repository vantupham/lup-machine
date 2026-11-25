import { configure, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../tests/setup/render';

async function setup(): Promise<{ repos: TestRepositories; projectId: string }> {
  const repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Nghe âm thanh', projectType: 'audio' });
  return { repos, projectId: project.id };
}

function render(repos: TestRepositories, projectId: string) {
  return renderApp(`/studio/${projectId}`, repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio);
}

/**
 * Mỗi kiểm thử tạo 48 đoạn âm thanh (64 KB mỗi đoạn) và tính ảnh phổ cho từng đoạn; mỗi lần tải lại
 * từ IndexedDB giả lập khá chậm khi cả bộ kiểm thử chạy song song, nên chờ lâu hơn mặc định.
 */
const SLOW_TEST_MS = 30_000;
configure({ asyncUtilTimeout: 10_000 });

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
    for (const c of [0, 1, 2]) expect(screen.getByTestId(`importance-${c}`).querySelectorAll('rect')).toHaveLength(160);
    expect(screen.getByText('Thu 1 giây hoặc tải một tệp âm thanh để thử.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    expect(screen.getByText(/bấm Huấn luyện để cập nhật/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    expect(await screen.findByText(/k-NN không học trọng số/)).toBeInTheDocument();
  }, SLOW_TEST_MS);

  test('thêm, đổi tên và xóa nhóm; trợ lý báo nhóm chưa đủ đoạn', async () => {
    const { repos, projectId } = await setup();
    render(repos, projectId);
    await userEvent.click(await screen.findByRole('button', { name: /Dùng âm thanh mẫu/ }));
    await screen.findByTestId('clip-count-2');
    await userEvent.type(screen.getByLabelText('Tên nhóm mới'), 'Tiếng vỗ tay');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhóm' }));
    expect(await screen.findByTestId('clip-count-3')).toHaveTextContent('0 đoạn');
    expect(screen.getByTestId('audio-issues')).toHaveTextContent('Nhóm "Tiếng vỗ tay" mới có 0 đoạn');

    const name = screen.getByRole('textbox', { name: 'Tên nhóm 1' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Chuông chùa');
    fireEvent.blur(name);
    await vi.waitFor(async () => expect((await repos.dataset.listClasses(projectId))[0]!.name).toBe('Chuông chùa'));
    expect((await screen.findAllByText(/Chuông chùa #1/, {}, { timeout: 5_000 })).length).toBeGreaterThan(0);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const card = screen.getByTestId('clip-count-3').closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: 'Xóa nhóm' }));
    expect(await screen.findByText('Chưa thấy vấn đề nào.')).toBeInTheDocument();
    expect((await repos.dataset.listClasses(projectId)).map((c) => c.name)).toEqual(['Chuông chùa', 'Còi', 'Trống']);
    vi.restoreAllMocks();
  }, SLOW_TEST_MS);

  test('Xưởng mô hình tạo được dự án Âm thanh (không tạo sẵn nhóm)', async () => {
    const repos = createTestRepository();
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments, repos.tables, repos.audio);
    await userEvent.type(await screen.findByLabelText('Tên dự án'), 'Âm thanh lớp 7');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Âm thanh mới' }));
    expect(await screen.findByRole('button', { name: /Dùng âm thanh mẫu/ })).toBeInTheDocument();
  });
});
