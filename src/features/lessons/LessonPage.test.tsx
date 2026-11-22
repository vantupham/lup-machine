import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { LESSONS } from '@/content/lessons';
import { createTestRepository, renderApp, type TestRepositories } from '../../../tests/setup/render';
import * as renderer from '@/features/samples/render-shape.browser';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/** fetch giả phục vụ đúng các tệp trong public/ (manifest và ảnh JPEG thật của bộ dữ liệu). */
function serveFromPublic(patch?: (path: string, body: Buffer) => Buffer | null) {
  return vi.fn(async (url: string) => {
    const path = String(url).replace(/^\/lup-machine\//, '').replace(/^\//, '');
    const full = join(process.cwd(), 'public', path);
    if (!existsSync(full)) return new Response('', { status: 404 });
    const body = patch ? patch(path, readFileSync(full)) : readFileSync(full);
    return body === null ? new Response('', { status: 404 }) : new Response(new Uint8Array(body));
  });
}

describe('Bộ dữ liệu mẫu trong Xưởng mô hình', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('3 bộ hình vẽ và 2 bộ ảnh thật có ghi giấy phép', async () => {
    open('/studio');
    expect(within(screen.getByRole('list', { name: 'Hình vẽ tổng hợp' })).getAllByRole('listitem')).toHaveLength(3);
    const photos = screen.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' });
    expect(within(photos).getAllByRole('listitem')).toHaveLength(2);
    expect(within(photos).getByText('CC BY 2.0')).toBeInTheDocument();
    expect(within(photos).getByText('MIT')).toBeInTheDocument();
  });

  test('tạo dự án từ bộ ảnh thật: đủ 90 ảnh, đúng ngăn Dạy/Kiểm tra, mỗi ảnh mang ghi công', async () => {
    vi.stubGlobal('fetch', serveFromPublic());
    open('/studio');
    const photos = screen.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' });
    await userEvent.click(within(photos).getAllByRole('button', { name: 'Tạo dự án mẫu' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hoa cúc, hướng dương hay hoa hồng?' }, { timeout: 10_000 })).toBeInTheDocument();
    const [project] = await repos.repository.findAll();
    const classes = await repos.dataset.listClasses(project!.id);
    expect(classes.map((c) => c.name)).toEqual(['Hoa cúc', 'Hướng dương', 'Hoa hồng']);
    const samples = await repos.dataset.listSamples(project!.id);
    expect(samples).toHaveLength(90);
    expect(samples.filter((x) => x.split === 'test')).toHaveLength(18);
    expect(samples.every((x) => x.credit?.license === 'CC BY 2.0' && x.credit.author.length > 0)).toBe(true);
    expect(new Uint8Array(samples[0]!.image.bytes).slice(0, 2)).toEqual(new Uint8Array([0xff, 0xd8]));
  });

  test('xem ghi công từng ảnh ngay trên thẻ (chỉ tải khi mở ra)', async () => {
    const fetchMock = serveFromPublic();
    vi.stubGlobal('fetch', fetchMock);
    open('/studio');
    const photos = screen.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' });
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(within(photos).getAllByText('Ghi công từng ảnh')[1]!);
    const list = await within(photos).findByTestId('credits-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(90);
    expect(within(list).getAllByText(/AIR Lab, Makerere University/)).toHaveLength(90);
  });

  test('manifest bị sửa sai (đường dẫn lạ) hoặc thiếu ảnh: báo lỗi, không tạo dự án dở dang', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', serveFromPublic((path, body) => {
      if (path.endsWith('beans-3/manifest.json')) {
        const m = JSON.parse(body.toString('utf8'));
        m.images[0].file = '../../index.html';
        return Buffer.from(JSON.stringify(m));
      }
      return body;
    }));
    open('/studio');
    const photos = screen.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' });
    await userEvent.click(within(photos).getAllByRole('button', { name: 'Tạo dự án mẫu' })[1]!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Không tạo được dự án mẫu/);

    vi.stubGlobal('fetch', serveFromPublic((path, body) => (path.endsWith('flowers-3/rose/03.jpg') ? null : body)));
    await userEvent.click(within(photos).getAllByRole('button', { name: 'Tạo dự án mẫu' })[0]!);
    expect(await screen.findByText(/rose\/03\.jpg \(404\)/)).toBeInTheDocument();
    expect(await repos.repository.findAll()).toHaveLength(0);
  });

  test('tạo dự án từ bộ hình vẽ', async () => {
    open('/studio');
    const panel = screen.getByRole('list', { name: 'Hình vẽ tổng hợp' });
    await userEvent.click(within(panel).getAllByRole('button', { name: 'Tạo dự án mẫu' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tròn hay vuông?' })).toBeInTheDocument();
    await waitFor(async () => expect(await repos.repository.findAll()).toHaveLength(1));
  });
});
