import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { LESSONS } from '@/content/lessons';
import { createTestRepository, renderApp, type TestRepositories } from '../../../tests/setup/render';
import * as renderer from '@/features/samples/render-shape.browser';

vi.mock('@/features/samples/render-shape.browser', () => ({
  renderShape: vi.fn(async () => ({ bytes: new Uint8Array([1]).buffer, mime: 'image/jpeg', width: 224, height: 224 })),
}));

let repos: TestRepositories;
const open = (route: string) => renderApp(route, repos.repository, repos.dataset, repos.experiments);

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  repos = createTestRepository();
});

describe('Bài học', () => {
  test('danh sách 3 bài học, có khối lớp và thời lượng', async () => {
    open('/lessons');
    expect(screen.getByRole('heading', { level: 1, name: 'Bài học' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /vào bài/i })).toHaveLength(LESSONS.length);
    expect(screen.getByText(/lớp 9–12 · 45 phút/i)).toBeInTheDocument();
  });

  test('bản tiếng Anh báo nội dung chỉ có tiếng Việt', async () => {
    await i18n.changeLanguage('en');
    open('/lessons');
    expect(screen.getByText(/available in Vietnamese only/i)).toBeInTheDocument();
  });

  test('mở bài: mục tiêu, các bước, câu hỏi dự đoán có đáp án ẩn', async () => {
    open('/lessons/ai-hoc-nham');
    expect(screen.getByRole('heading', { level: 1, name: 'AI học nhầm điều gì?' })).toBeInTheDocument();
    const steps = screen.getByRole('region', { name: 'Các bước' });
    const predict = within(steps).getAllByText(/dự đoán trước/i)[1]!;
    const details = predict.closest('details')!;
    expect(details.open).toBe(false);
    await userEvent.click(predict);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/nền sáng → tròn/)).toBeVisible();
  });

  test('câu hỏi kiểm tra: phản hồi đúng / sai, tổng điểm và làm lại', async () => {
    open('/lessons/may-tinh-nhin-anh');
    const quiz = screen.getByRole('region', { name: 'Kiểm tra nhanh' });
    const groups = within(quiz).getAllByRole('group');
    await userEvent.click(within(groups[0]!).getByLabelText(/một ô màu nhỏ nhất/i));
    expect(within(groups[0]!).getByText('Đúng rồi!')).toBeInTheDocument();
    await userEvent.click(within(groups[1]!).getByLabelText('Đỏ'));
    expect(within(groups[1]!).getByText('Chưa đúng.')).toBeInTheDocument();
    expect(within(groups[1]!).getByLabelText('Xanh dương')).toBeDisabled();
    await userEvent.click(within(groups[2]!).getByLabelText(/không nói lên đó là vật gì/i));
    expect(within(quiz).getByText('Em trả lời đúng 2/3 câu.')).toBeInTheDocument();
    await userEvent.click(within(quiz).getByRole('button', { name: 'Làm lại' }));
    expect(within(quiz).queryByText(/em trả lời đúng/i)).toBeNull();
  });

  test('tạo dự án mẫu cho bài và chuyển sang Xưởng', async () => {
    open('/lessons/day-may-phan-biet-hinh');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Tam giác' })).toBeInTheDocument();
    const [project] = await repos.repository.findAll();
    const counts = await repos.dataset.countSamples(project!.id);
    expect(Object.values(counts)).toEqual([
      { train: 18, test: 6 },
      { train: 18, test: 6 },
      { train: 18, test: 6 },
    ]);
  });

  test('báo lỗi nếu không vẽ được ảnh mẫu', async () => {
    vi.mocked(renderer.renderShape).mockRejectedValueOnce(new Error('canvas lỗi'));
    open('/lessons/ai-hoc-nham');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/canvas lỗi/);
  });

  test('bài học không tồn tại', () => {
    open('/lessons/khong-co');
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy bài học này.');
  });
});

describe('Bộ dữ liệu mẫu trong Xưởng mô hình', () => {
  test('hiển thị 3 bộ và tạo dự án từ một bộ', async () => {
    open('/studio');
    const panel = screen.getByRole('region', { name: /bộ dữ liệu mẫu/i });
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(within(panel).getAllByRole('button', { name: 'Tạo dự án mẫu' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tròn hay vuông?' })).toBeInTheDocument();
    await waitFor(async () => expect(await repos.repository.findAll()).toHaveLength(1));
  });
});
