import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ProjectRepository } from '@/storage/repositories/project-repository';
import { createTestRepository, renderApp } from '../../../tests/setup/render';
import { UNDO_DELETE_MS } from '@/features/studio/project-list/useUndoableDelete';

describe('trang Mô hình', () => {
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

  test('tạo dự án ảnh xong thì vào thẳng dự án', async () => {
    const { repository } = createTestRepository();
    renderApp('/studio', repository);
    await userEvent.type(screen.getByLabelText('Tên dự án'), 'Phân loại rác');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Phân loại rác' })).toBeInTheDocument();
    expect(await repository.findAll()).toHaveLength(1);
  });

  test('dự án đã có hiện trong danh sách', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'Phân loại rác', projectType: 'image' });
    renderApp('/studio', repository);
    const list = await screen.findByRole('list', { name: 'Dự án của em' });
    expect(within(list).getByText('Phân loại rác')).toBeInTheDocument();
  });

  test('cả 5 loại dự án đều dùng được, không còn loại "sắp có"', () => {
    renderApp('/studio', createTestRepository().repository);
    for (const type of ['Ảnh', 'Bảng số', 'Văn bản', 'Âm thanh', 'Tư thế']) {
      expect(screen.getByRole('button', { name: `Tạo dự án ${type} mới` })).toBeEnabled();
    }
    expect(screen.queryByText(/sắp có/i)).toBeNull();
  });

  test('để trống tên thì tự đặt tên theo loại dữ liệu', async () => {
    const { repository } = createTestRepository();
    renderApp('/studio', repository);
    await userEvent.type(screen.getByLabelText('Tên dự án'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Văn bản mới' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dự án văn bản 1' })).toBeInTheDocument();
  });

  test('xóa một chạm: dự án biến mất ngay, không hỏi lại, và chỉ bị xóa thật khi hết giờ hoàn tác', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { repository } = createTestRepository();
    await repository.create({ name: 'Cần xóa', projectType: 'image' });
    const confirm = vi.spyOn(window, 'confirm');
    renderApp('/studio', repository);
    await user.click(await screen.findByRole('button', { name: 'Xóa Cần xóa' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText(/chưa có dự án nào/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đã xóa "Cần xóa".');
    expect(await repository.findAll()).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(UNDO_DELETE_MS));
    await waitFor(async () => expect(await repository.findAll()).toHaveLength(0));
    expect(screen.queryByRole('button', { name: 'Hoàn tác' })).toBeNull();
    vi.useRealTimers();
  });

  test('bấm Hoàn tác thì dự án quay lại và không bị xóa', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { repository } = createTestRepository();
    await repository.create({ name: 'Giữ lại', projectType: 'image' });
    renderApp('/studio', repository);
    await user.click(await screen.findByRole('button', { name: 'Xóa Giữ lại' }));
    await user.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    expect(screen.getByRole('listitem', { name: 'Giữ lại' })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(UNDO_DELETE_MS * 2));
    expect(await repository.findAll()).toHaveLength(1);
    vi.useRealTimers();
  });

  test('đóng thông báo thì xóa ngay; xóa dự án thứ hai thì dự án đầu bị xóa thật', async () => {
    const { repository } = createTestRepository();
    for (const name of ['Một', 'Hai', 'Ba']) await repository.create({ name, projectType: 'image' });
    renderApp('/studio', repository);
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Một' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xóa Hai' }));
    await waitFor(async () => expect((await repository.findAll()).map((p) => p.name).sort()).toEqual(['Ba', 'Hai']));
    expect(screen.queryByRole('listitem', { name: 'Hai' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(async () => expect((await repository.findAll()).map((p) => p.name)).toEqual(['Ba']));
    expect(screen.getByRole('listitem', { name: 'Ba' })).toBeInTheDocument();
  });

  test('rời trang Mô hình khi còn đang chờ hoàn tác thì vẫn xóa thật', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'Rời đi', projectType: 'image' });
    const view = renderApp('/studio', repository);
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Rời đi' }));
    view.unmount();
    await waitFor(async () => expect(await repository.findAll()).toHaveLength(0));
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
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án Ảnh mới' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('đầy bộ nhớ');
  });

  test('một khối "Dự án mới" duy nhất: ô tên ở trên, 5 thẻ loại dữ liệu có biểu tượng ngay dưới', async () => {
    renderApp('/studio', createTestRepository().repository);
    const fresh = screen.getByRole('region', { name: 'Dự án mới' });
    expect(within(fresh).getByRole('textbox', { name: 'Tên dự án' })).toBeInTheDocument();
    const cards = within(fresh).getAllByRole('button', { name: /^Tạo dự án .* mới$/ });
    expect(cards).toHaveLength(5);
    for (const card of cards) expect(card.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    expect(within(fresh).queryByRole('radio')).toBeNull();
    expect(await screen.findByText(/chưa có dự án nào/i)).toBeInTheDocument();
  });

  test('thẻ dự án ảnh cho biết số lớp, số ảnh, số lần huấn luyện và có ảnh thu nhỏ', async () => {
    const repos = createTestRepository();
    const project = await repos.repository.create({ name: 'Phân loại rác', projectType: 'image' });
    const paper = await repos.dataset.addClass(project.id, 'Giấy');
    await repos.dataset.addClass(project.id, 'Nhựa');
    const image = { bytes: new ArrayBuffer(4), mime: 'image/png', width: 1, height: 1 };
    await repos.dataset.addSamples([1, 2, 3].map(() => ({ projectId: project.id, classId: paper.id, split: 'train' as const, source: 'upload' as const, image })));
    await repos.experiments.addRun({
      projectId: project.id,
      fingerprint: 'f',
      options: { epochs: 1, learningRate: 0.01, batchSize: 8, seed: 1 },
      classNames: ['Giấy', 'Nhựa'],
      counts: { train: 3, test: 0 },
      metrics: [{ epoch: 1, trainLoss: 0.5, trainAccuracy: 0.5, testLoss: null, testAccuracy: null }],
    });
    renderApp('/studio', repos.repository, repos.dataset, repos.experiments);
    const card = await screen.findByRole('listitem', { name: 'Phân loại rác' });
    expect(await within(card).findByText('2 lớp · 3 ảnh')).toBeInTheDocument();
    expect(within(card).getByText('Đã huấn luyện 1 lần')).toBeInTheDocument();
    expect(within(card).getAllByTestId('project-thumb')).toHaveLength(1);
  });

  test('thẻ dự án chưa có dữ liệu nói rõ điều đó', async () => {
    const repos = createTestRepository();
    await repos.repository.create({ name: 'Góp ý', projectType: 'text' });
    await repos.repository.create({ name: 'Tiếng động', projectType: 'audio' });
    renderApp('/studio', repos.repository, repos.dataset);
    expect(await within(await screen.findByRole('listitem', { name: 'Góp ý' })).findByText('Chưa có dữ liệu')).toBeInTheDocument();
    expect(await within(screen.getByRole('listitem', { name: 'Tiếng động' })).findByText('Chưa có dữ liệu')).toBeInTheDocument();
  });

  test('tìm dự án theo tên, gõ không dấu vẫn ra', async () => {
    const { repository } = createTestRepository();
    for (const name of ['Phân loại rác', 'Lá cây bệnh', 'Góp ý căng tin', 'Vỗ tay', 'Giơ tay']) await repository.create({ name, projectType: 'image' });
    renderApp('/studio', repository);
    const search = await screen.findByRole('searchbox', { name: 'Tìm dự án' });
    await userEvent.type(search, 'rac');
    const list = screen.getByRole('list', { name: 'Dự án của em' });
    expect(within(list).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(['Phân loại rác']);
    await userEvent.clear(search);
    await userEvent.type(search, 'xyz');
    expect(screen.getByText('Không có dự án nào có tên chứa "xyz".')).toBeInTheDocument();
  });

  test('ít dự án thì không cần ô tìm kiếm', async () => {
    const { repository } = createTestRepository();
    await repository.create({ name: 'Một', projectType: 'image' });
    renderApp('/studio', repository);
    await screen.findByRole('list', { name: 'Dự án của em' });
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  test('xóa bớt còn dưới 5 dự án thì ô tìm biến mất và bộ lọc cũng thôi áp dụng', async () => {
    const { repository } = createTestRepository();
    for (const name of ['Một', 'Hai', 'Ba', 'Bốn', 'Năm']) await repository.create({ name, projectType: 'image' });
    renderApp('/studio', repository);
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Tìm dự án' }), 'năm');
    await userEvent.click(screen.getByRole('button', { name: 'Xóa Năm' }));
    expect(screen.queryByRole('searchbox')).toBeNull();
    const list = screen.getByRole('list', { name: 'Dự án của em' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
  });

  test('xóa thất bại thì báo lỗi, dự án vẫn còn', async () => {
    const repos = createTestRepository();
    await repos.repository.create({ name: 'Cứng đầu', projectType: 'image' });
    const broken = { ...repos.repository, delete: () => Promise.reject(new Error('bị khóa')) } satisfies ProjectRepository;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderApp('/studio', broken);
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Cứng đầu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không xóa được dự án "Cứng đầu": bị khóa');
    expect(await screen.findByRole('listitem', { name: 'Cứng đầu' })).toBeInTheDocument();
  });
});
