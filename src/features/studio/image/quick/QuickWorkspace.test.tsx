import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { useModeStore } from '@/ui/mode-store';
import type { StoredImage } from '@/storage/db';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../../tests/setup/render';
import * as codec from '../image-codec.browser';
import * as loader from '../feature-loader.browser';

const imageOf = (tone: number, n: number): StoredImage => ({ bytes: new Uint8Array([tone, n]).buffer, mime: 'image/jpeg', width: 224, height: 224 });

vi.mock('../image-codec.browser', () => ({
  fileToStoredImage: vi.fn(),
  videoFrameToStoredImage: vi.fn(),
  decodeStoredImage: vi.fn(async (img: StoredImage) => {
    const [tone, n] = new Uint8Array(img.bytes);
    const data = new Uint8ClampedArray(224 * 224 * 4);
    data.set([tone!, n!, 0, 255]);
    return { width: 224, height: 224, data };
  }),
}));

function fakeVector(tone: number, n: number): Float32Array {
  const v = new Float32Array(1280);
  v[0] = tone / 255;
  v[1] = 1 - tone / 255;
  v[2] = n / 50;
  return v;
}

vi.mock('../feature-loader.browser', () => ({
  loadFeatureExtractor: vi.fn(async () => ({
    modelId: 'mobilenet-v2-035',
    dispose: () => undefined,
    extract: async (images: { data: Uint8ClampedArray }[], onProgress?: (n: number) => void) => {
      onProgress?.(images.length);
      return images.map((img) => fakeVector(img.data[0]!, img.data[1]!));
    },
  })),
}));

// Huấn luyện 50 epoch trong jsdom: chạy cả bộ song song kèm đo độ phủ có thể chậm gấp 3–4 lần.
vi.setConfig({ testTimeout: 40_000 });

const TRAIN_WAIT_MS = 25_000;

let repos: TestRepositories;
let projectId: string;

async function seed(classNames: readonly string[] = ['Nhựa', 'Giấy'], perClass = 6) {
  repos = createTestRepository();
  projectId = (await repos.repository.create({ name: 'Nhanh', projectType: 'image' })).id;
  const tones = [20, 230, 120];
  for (const [ci, name] of classNames.entries()) {
    const c = await repos.dataset.addClass(projectId, name);
    if (perClass === 0) continue;
    await repos.dataset.addSamples(
      Array.from({ length: perClass }, (_, k) => ({ projectId, classId: c.id, split: 'train' as const, source: 'upload' as const, image: imageOf(tones[ci]!, k) })),
    );
  }
}

const open = () => renderApp(`/studio/${projectId}`, repos.repository, repos.dataset, repos.experiments);
const quick = () => screen.getByRole('region', { name: 'Dạy máy trong 3 bước' });

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
  window.scrollTo = vi.fn();
});

describe('khối làm nhanh kiểu Teachable Machine (chế độ Khám phá)', () => {
  test('3 cột: thu ảnh, huấn luyện, xem thử; mỗi lớp có số ảnh và nút chụp / tải', async () => {
    await seed();
    open();
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    for (const name of ['1. Thu ảnh', '2. Cho máy học', '3. Xem thử']) expect(within(region).getByRole('heading', { name })).toBeInTheDocument();
    const plastic = within(region).getByRole('group', { name: 'Nhựa' });
    expect(within(plastic).getByText('6 ảnh')).toBeInTheDocument();
    expect(within(plastic).getByRole('button', { name: 'Chụp ảnh cho lớp Nhựa' })).toBeInTheDocument();
    expect(within(plastic).getByLabelText('Tải ảnh cho lớp Nhựa')).toBeInTheDocument();
    expect(within(region).getByText('Huấn luyện xong mới xem thử được.')).toBeInTheDocument();
  });

  test('chế độ Chuyên sâu: không có khối làm nhanh, giữ bố cục 6 bước', async () => {
    useModeStore.setState({ mode: 'expert' });
    await seed();
    open();
    await screen.findByRole('heading', { level: 1, name: 'Nhanh' });
    expect(screen.queryByRole('region', { name: 'Dạy máy trong 3 bước' })).toBeNull();
  });

  test('một nút "Huấn luyện nhanh": tự biến ảnh thành vector, huấn luyện xong, phần mở nắp bên dưới cũng thấy kết quả', async () => {
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: 'Huấn luyện nhanh' }));
    expect(await within(quick()).findByText(/Xong! Máy đoán đúng 100% ảnh dạy\./, {}, { timeout: TRAIN_WAIT_MS })).toBeInTheDocument();
    expect(screen.getByText('Xong 50 epoch.')).toBeInTheDocument();
    expect(screen.getByText(/tất cả ảnh đã có vector/i)).toBeInTheDocument();
    expect(await repos.experiments.listRuns(projectId)).toHaveLength(1);
  });

  test('chưa đủ 2 lớp có ảnh thì nút bị khóa và nói rõ lý do', async () => {
    await seed(['Nhựa', 'Giấy'], 0);
    open();
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    expect(within(region).getByRole('button', { name: 'Huấn luyện nhanh' })).toBeDisabled();
    expect(within(region).getByText('Cần ít nhất 2 lớp có ảnh.')).toBeInTheDocument();
  });

  test('xem thử bằng tệp ảnh: hiện thanh phần trăm cho từng lớp, lớp máy chọn đứng đầu', async () => {
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: 'Huấn luyện nhanh' }));
    await within(quick()).findByText(/Xong!/, {}, { timeout: TRAIN_WAIT_MS });
    vi.mocked(codec.fileToStoredImage).mockResolvedValue(imageOf(235, 3));
    await userEvent.upload(within(quick()).getByLabelText('Thử với một tệp ảnh'), new File(['x'], 'moi.jpg', { type: 'image/jpeg' }));
    const result = await within(quick()).findByRole('list', { name: 'Máy đoán' });
    const rows = within(result).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Giấy\s*\d+%$/);
    expect(rows[1]).toHaveTextContent(/Nhựa\s*\d+%$/);
  });

  test('"+ Thêm lớp" tạo lớp mới tên chưa dùng', async () => {
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: '+ Thêm lớp' }));
    await waitFor(async () => expect((await repos.dataset.listClasses(projectId)).map((c) => c.name)).toEqual(['Nhựa', 'Giấy', 'Lớp 3']));
    expect(await within(quick()).findByRole('group', { name: 'Lớp 3' })).toBeInTheDocument();
  });

  test('"Chụp ảnh" mở đúng hộp chụp webcam của lớp đó (ảnh vào ngăn Dạy)', async () => {
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: 'Chụp ảnh cho lớp Giấy' }));
    expect(await screen.findByRole('dialog', { name: /Giấy/ })).toBeInTheDocument();
  });

  test('tải ảnh từ cột 1 vào ngăn Dạy; huấn luyện rồi đổi dữ liệu thì báo cần huấn luyện lại', async () => {
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: 'Huấn luyện nhanh' }));
    await within(quick()).findByText(/Xong!/, {}, { timeout: TRAIN_WAIT_MS });
    vi.mocked(codec.fileToStoredImage).mockResolvedValue(imageOf(20, 40));
    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    await userEvent.upload(within(quick()).getByLabelText('Tải ảnh cho lớp Nhựa'), files);
    expect(await within(within(quick()).getByRole('group', { name: 'Nhựa' })).findByText('8 ảnh')).toBeInTheDocument();
    expect((await repos.dataset.listSamples(projectId)).filter((s) => s.split === 'test')).toHaveLength(0);
    expect(await within(quick()).findByText('Dữ liệu vừa đổi: hãy huấn luyện lại.')).toBeInTheDocument();
  });

  test('không tải được mô hình nhận dạng ảnh thì báo lỗi, không huấn luyện', async () => {
    vi.mocked(loader.loadFeatureExtractor).mockRejectedValueOnce(new Error('mất mạng'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: 'Huấn luyện nhanh' }));
    expect(await within(quick()).findByText('Có lỗi: mất mạng')).toBeInTheDocument();
    expect(await repos.experiments.listRuns(projectId)).toHaveLength(0);
    vi.mocked(console.error).mockRestore();
  });

  test('"Mở nắp" đưa tới bước ④ Huấn luyện; xem thử: tệp không phải ảnh bị từ chối, nút webcam bật / tắt', async () => {
    await seed();
    open();
    const region = await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    await userEvent.click(within(region).getByRole('button', { name: /Mở nắp: xem máy học thế nào/ }));
    expect(window.scrollTo).toHaveBeenCalled();
    expect(document.getElementById('train-title')).toHaveFocus();

    await userEvent.click(within(region).getByRole('button', { name: 'Huấn luyện nhanh' }));
    await within(quick()).findByText(/Xong!/, {}, { timeout: TRAIN_WAIT_MS });
    await userEvent.upload(within(quick()).getByLabelText('Thử với một tệp ảnh'), new File(['x'], 'ghi-chu.txt', { type: 'text/plain' }), { applyAccept: false });
    expect(within(quick()).getByRole('alert')).toBeInTheDocument();
    expect(within(quick()).queryByRole('list', { name: 'Máy đoán' })).toBeNull();

    await userEvent.click(within(quick()).getByRole('button', { name: /Xem thử bằng webcam/ }));
    expect(quick().querySelector('video')).not.toBeNull();
    await userEvent.click(within(quick()).getByRole('button', { name: 'Dừng xem thử' }));
    expect(quick().querySelector('video')).toBeNull();
    expect(within(quick()).getByRole('button', { name: /Xem thử bằng webcam/ })).not.toHaveAttribute('aria-pressed');
  });

  test('đang biến ảnh thành vector ở bước ③ thì "Huấn luyện nhanh" chờ; xong thì huấn luyện, không trích lại', async () => {
    await seed();
    open();
    await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' });
    // Giữ trình trích ở trạng thái "đang tải mô hình" cho tới khi kiểm thử cho phép.
    const real = vi.mocked(loader.loadFeatureExtractor).getMockImplementation()!;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(loader.loadFeatureExtractor).mockClear();
    vi.mocked(loader.loadFeatureExtractor).mockImplementationOnce(async () => {
      await gate;
      return real();
    });
    await userEvent.click(await screen.findByRole('button', { name: /biến ảnh thành vector \(12 ảnh/i }));
    const quickTrain = within(quick()).getByRole('button', { name: 'Huấn luyện nhanh' });
    expect(quickTrain).toBeDisabled();
    expect(within(quick()).getByText('Đang tải mô hình nhận dạng ảnh…')).toBeInTheDocument();
    release();
    await waitFor(() => expect(quickTrain).toBeEnabled(), { timeout: TRAIN_WAIT_MS });
    await userEvent.click(quickTrain);
    await within(quick()).findByText(/Xong!/, {}, { timeout: TRAIN_WAIT_MS });
    expect(loader.loadFeatureExtractor).toHaveBeenCalledTimes(1);
    expect(await repos.experiments.listRuns(projectId)).toHaveLength(1);
  });

  test('đang xem thử bằng webcam mà mở hộp chụp ảnh thì tạm tắt xem thử (một camera không mở được hai lần)', async () => {
    await seed();
    open();
    await userEvent.click(await within(await screen.findByRole('region', { name: 'Dạy máy trong 3 bước' })).findByRole('button', { name: 'Huấn luyện nhanh' }));
    await within(quick()).findByText(/Xong!/, {}, { timeout: TRAIN_WAIT_MS });
    await userEvent.click(within(quick()).getByRole('button', { name: /Xem thử bằng webcam/ }));
    expect(quick().querySelector('video')).not.toBeNull();
    await userEvent.click(within(quick()).getByRole('button', { name: 'Chụp ảnh cho lớp Giấy' }));
    await screen.findByRole('dialog', { name: /Giấy/ });
    expect(quick().querySelector('video')).toBeNull();
  });
});

