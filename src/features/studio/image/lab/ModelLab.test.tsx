import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { FEATURE_MODEL_ID } from '@/core/ml/feature-model';
import { useModeStore } from '@/ui/mode-store';
import type { StoredImage } from '@/storage/db';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../../tests/setup/render';
import * as loader from '../feature-loader.browser';
import * as codec from '../image-codec.browser';
import { useStepDetailsStore } from '@/features/studio/step-details';

/** Ảnh giả: byte 0 = "màu" theo lớp, byte 1 = số thứ tự (để các vector hơi khác nhau). */
const imageOf = (tone: number, n: number): StoredImage => ({ bytes: new Uint8Array([tone, n]).buffer, mime: 'image/jpeg', width: 224, height: 224 });

vi.mock('../image-codec.browser', () => ({
  fileToStoredImage: vi.fn(),
  videoFrameToStoredImage: vi.fn(),
  // Ảnh 224×224 thật, chỉ điểm ảnh đầu tiên mang thông tin → che ô (hàng 1, cột 1) làm vector đổi, che ô khác thì không.
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
    // 49 ô giống hệt nhau → trung bình không gian đúng bằng vector đặc trưng (nhất quán với extract).
    extractSpatial: async (images: { data: Uint8ClampedArray }[]) =>
      images.map((img) => {
        const v = fakeVector(img.data[0]!, img.data[1]!);
        const out = new Float32Array(49 * 1280);
        for (let cell = 0; cell < 49; cell++) out.set(v, cell * 1280);
        return out;
      }),
    extractLayers: async (_image: unknown, names: string[]) =>
      names.map((layer, i) => {
        const size = 112 >> i;
        const channels = 12;
        return { layer, height: size, width: size, channels, data: Float32Array.from({ length: size * size * channels }, (_, k) => (k % channels) / channels) };
      }),
  })),
}));

// Huấn luyện 50 epoch kèm vẽ lại biểu đồ trong jsdom mất vài giây.
// Huấn luyện 50 epoch trong jsdom mất vài giây, và lâu hơn nhiều khi cả bộ kiểm thử chạy song song.
vi.setConfig({ testTimeout: 40_000 });
const SLOW_WAIT = { timeout: 25_000 };

let repos: TestRepositories;
let projectId: string;

async function seed({ perClass = 6, testPerClass = 2, confusingTest = false } = {}) {
  repos = createTestRepository();
  projectId = (await repos.repository.create({ name: 'Lab', projectType: 'image' })).id;
  const tones = [20, 230];
  for (const [ci, name] of ['Nhựa', 'Giấy'].entries()) {
    const c = await repos.dataset.addClass(projectId, name);
    const mk = (split: 'train' | 'test', count: number, offset: number) =>
      Array.from({ length: count }, (_, k) => ({
        projectId,
        classId: c.id,
        split,
        source: 'upload' as const,
        // confusingTest: ảnh Kiểm tra lớp "Nhựa" trông giống "Giấy" → mô hình đoán sai
        image: imageOf(split === 'test' && confusingTest && ci === 0 ? tones[1]! : tones[ci]!, offset + k),
      }));
    await repos.dataset.addSamples([...mk('train', perClass, 0), ...mk('test', testPerClass, perClass)]);
  }
}

const open = () => renderApp(`/studio/${projectId}`, repos.repository, repos.dataset, repos.experiments);

async function extractAll() {
  await userEvent.click(await screen.findByRole('button', { name: /biến ảnh thành vector \(16 ảnh/i }));
  await screen.findByText(/tất cả ảnh đã có vector/i);
}

async function trainToEnd() {
  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu huấn luyện' }));
  await screen.findByText('Xong 50 epoch.', {}, SLOW_WAIT);
}

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
  useStepDetailsStore.setState({ isOpen: true });
});

describe('Bước 3: Biểu diễn', () => {
  test('trích đặc trưng, lưu cache và vẽ bản đồ PCA với mọi ảnh', async () => {
    await seed();
    open();
    expect(await screen.findByText(/cần làm bước 3 \(biểu diễn\) trước/i)).toBeInTheDocument();
    await extractAll();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    expect(within(map).getAllByRole('button')).toHaveLength(16);
    expect(screen.getByTestId('map-kept')).toHaveTextContent(/giữ được .*%/);
    expect((await repos.dataset.listFeatures(projectId, FEATURE_MODEL_ID)).size).toBe(16);
  });

  test('đọc vector đã lưu (cache) khi mở lại dự án', async () => {
    await seed();
    const samples = await repos.dataset.listSamples(projectId);
    await repos.dataset.putFeatures(projectId, FEATURE_MODEL_ID, samples.map((s, i) => ({ sampleId: s.id, vector: fakeVector(i, i) })));
    open();
    expect(await screen.findByText(/tất cả ảnh đã có vector/i)).toBeInTheDocument();
  });

  test('bấm một chấm: xem 1280 con số và các ảnh Huấn luyện giống nhất', async () => {
    await seed();
    open();
    await extractAll();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button', { name: /ảnh lớp nhựa, ngăn huấn luyện/i })[0]!);
    const detail = await screen.findByTestId('selected-detail');
    expect(within(detail).getByTestId('feature-strip').querySelectorAll('rect')).toHaveLength(1280);
    expect(within(detail).getByText(/ảnh huấn luyện giống nhất/i)).toBeInTheDocument();
    expect(within(detail).getAllByText(/^Nhựa · /)).toHaveLength(3);
  });

  test('báo lỗi khi không tải được mô hình', async () => {
    vi.mocked(loader.loadFeatureExtractor).mockRejectedValueOnce(new Error('mạng lỗi'));
    await seed();
    open();
    await userEvent.click(await screen.findByRole('button', { name: /biến ảnh thành vector/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/mạng lỗi/);
  });
});

describe('Bước 4: Huấn luyện và bước 5: Đánh giá', () => {
  test('huấn luyện, xem điểm Huấn luyện / Kiểm tra và ma trận nhầm lẫn bấm được', async () => {
    await seed();
    open();
    expect(await screen.findByText('Huấn luyện ở bước 4 để xem kết quả.')).toBeInTheDocument();
    await extractAll();
    await trainToEnd();
    expect(screen.getByTestId('score-train')).toHaveTextContent('100%');
    expect(screen.getByTestId('score-test')).toHaveTextContent('100%');
    expect(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '2 ảnh lớp Nhựa bị đoán là Nhựa' }));
    expect(within(screen.getByTestId('cell-samples')).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: '0 ảnh lớp Nhựa bị đoán là Giấy' }));
    expect(screen.getByText('Không có ảnh nào ở ô này.')).toBeInTheDocument();
  });

  test('phát lại epoch 0: mô hình còn đoán bừa', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    expect(screen.getByText('Kết quả tại epoch 50')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: /phát lại/i }), { target: { value: '0' } });
    expect(await screen.findByText('Kết quả tại epoch 0')).toBeInTheDocument();
    expect(screen.getByText('Phát lại: epoch 0')).toBeInTheDocument();
  });

  test('Mã Python: chưa huấn luyện thì nhắc; huấn luyện xong chạy mã với đúng dữ liệu của dự án', async () => {
    await seed();
    open();
    await extractAll();
    const panel = () => screen.getByTestId('code-trace');
    await userEvent.click(within(panel()).getByText('Mã Python'));
    expect(within(panel()).getByText('Huấn luyện một lần để chạy mã với dữ liệu của bạn.')).toBeVisible();

    await trainToEnd();
    await userEvent.click(within(panel()).getByRole('button', { name: /Chạy 1 dòng/ }));
    const vars = within(panel()).getByRole('region', { name: 'Biến' });
    expect(within(vars).getByText('X_train').parentElement).toHaveTextContent('(12, 1280)');
    expect(within(vars).getByText('EPOCHS').parentElement).toHaveTextContent('50');
    await userEvent.click(within(panel()).getByRole('button', { name: /Đến hết epoch/ }));
    expect(within(panel()).getByTestId('code-trace-console').textContent).toMatch(/^epoch 1: loss \d\.\d{3}, đúng \d+%$/);
  });

  test('chế độ từng bước: mỗi lần bấm chạy đúng 1 epoch', async () => {
    await seed();
    open();
    await extractAll();
    await userEvent.click(screen.getByRole('radio', { name: 'Từng bước' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu huấn luyện' }));
    await screen.findByText('Đang huấn luyện… epoch 0/50');
    await userEvent.click(screen.getByRole('button', { name: /epoch tiếp theo/i }));
    expect(await screen.findByText('Đang huấn luyện… epoch 1/50')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Chạy hết' }));
    expect(await screen.findByText('Xong 50 epoch.', {}, SLOW_WAIT)).toBeInTheDocument();
  });

  test('cảnh báo quá khớp và vòng đỏ trên bản đồ khi ảnh Kiểm tra bị đoán sai', async () => {
    await seed({ confusingTest: true });
    open();
    await extractAll();
    await trainToEnd();
    expect(screen.getByTestId('score-test')).toHaveTextContent('50%');
    expect(screen.getByRole('alert')).toHaveTextContent(/quá khớp/);
    expect(screen.getAllByTestId('wrong-ring')).toHaveLength(2);
  });

  test('chế độ Chuyên sâu: chỉnh tham số, chặn giá trị sai, có bảng precision / recall', async () => {
    useModeStore.setState({ mode: 'expert' });
    await seed();
    open();
    await extractAll();
    const epochs = screen.getByLabelText('Số epoch');
    await userEvent.clear(epochs);
    await userEvent.type(epochs, '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Tham số không hợp lệ.');
    expect(screen.getByRole('button', { name: 'Bắt đầu huấn luyện' })).toBeDisabled();
    await userEvent.clear(epochs);
    await userEvent.type(epochs, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu huấn luyện' }));
    await screen.findByText('Xong 5 epoch.', {}, SLOW_WAIT);
    expect(screen.getByRole('table', { name: 'Theo từng lớp' })).toBeInTheDocument();
  });

  test('thêm lớp sau khi huấn luyện: yêu cầu huấn luyện lại', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    await userEvent.click(within(screen.getByRole('region', { name: 'Dữ liệu' })).getByRole('button', { name: 'Thêm lớp' }));
    expect(await screen.findByText(/các lớp đã đổi/i)).toBeInTheDocument();
    expect(screen.getByText('Huấn luyện ở bước 4 để xem kết quả.')).toBeInTheDocument();
    // mô hình cũ không còn khớp dữ liệu: không cho xuất notebook
    expect(screen.queryByRole('button', { name: 'Tải notebook (.ipynb)' })).toBeNull();
  });

  test('nhật ký: lưu mỗi lần huấn luyện mới, so sánh và xóa', async () => {
    useModeStore.setState({ mode: 'expert' });
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    const log = await screen.findByRole('table', { name: 'Nhật ký thí nghiệm' });
    expect(await within(log).findByText('#1')).toBeInTheDocument();

    const epochs = screen.getByLabelText('Số epoch');
    await userEvent.clear(epochs);
    await userEvent.type(epochs, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện lại' }));
    await screen.findByText('Xong 3 epoch.');
    expect(await within(log).findByText('#2')).toBeInTheDocument();
    expect(within(log).getByText(/3 ep · lr 0.001/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'So sánh lần 1' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'So sánh lần 2' }));
    expect(screen.getByRole('img', { name: /điểm kiểm tra theo epoch/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Xóa lần 1' }));
    await waitFor(() => expect(within(log).queryByText('#1')).toBeNull());
    expect(await repos.experiments.listRuns(projectId)).toHaveLength(1);
  });

  test('chạy lại một lần cũ cho đúng kết quả và không lưu trùng', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    const firstScore = screen.getByTestId('score-test').textContent;
    await userEvent.click(await screen.findByRole('button', { name: 'Chạy lại lần 1' }));
    expect(await screen.findByText('Đang xem lại lần 1.')).toBeInTheDocument();
    await screen.findByText('Xong 50 epoch.', {}, SLOW_WAIT);
    expect(screen.getByTestId('score-test').textContent).toBe(firstScore);
    expect(await repos.experiments.listRuns(projectId)).toHaveLength(1);
  });

  test('mở lại dự án: tự khôi phục lần chạy gần nhất bằng cùng seed', async () => {
    await seed();
    const view = open();
    await extractAll();
    await trainToEnd();
    await waitFor(async () => expect(await repos.experiments.listRuns(projectId)).toHaveLength(1));
    view.unmount();

    open();
    expect(await screen.findByText('Đã khôi phục lần 1 bằng cách chạy lại với cùng seed 42.')).toBeInTheDocument();
    await screen.findByText('Xong 50 epoch.', {}, SLOW_WAIT);
    expect(screen.getByTestId('score-test')).toHaveTextContent('100%');
  });

  test('dữ liệu đổi sau lần chạy: không chạy lại được, không tự khôi phục', async () => {
    await seed();
    const view = open();
    await extractAll();
    await trainToEnd();
    await waitFor(async () => expect(await repos.experiments.listRuns(projectId)).toHaveLength(1));
    view.unmount();
    const [first] = await repos.dataset.listSamples(projectId);
    await repos.dataset.setSplits([{ id: first!.id, split: 'test' }]);

    open();
    expect(await screen.findByText('Dữ liệu đã thay đổi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chạy lại lần 1' })).toBeNull();
    expect(screen.getByText('Huấn luyện ở bước 4 để xem kết quả.')).toBeInTheDocument();
  });

  test('chưa huấn luyện: phần giải thích nhắc huấn luyện trước', async () => {
    await seed();
    open();
    await extractAll();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button')[0]!);
    expect(await screen.findByText('Huấn luyện ở bước 4 để xem giải thích.')).toBeInTheDocument();
  });

  test('giải thích dự đoán: xác suất, bản đồ CAM 7×7 và (Chuyên sâu) đường đi phép tính khớp logit', async () => {
    useModeStore.setState({ mode: 'expert' });
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button', { name: /ảnh lớp nhựa, ngăn kiểm tra/i })[0]!);
    const explainer = await screen.findByTestId('explainer');
    expect(within(explainer).getByTestId('prob-0').textContent).toMatch(/%$/);

    const heatmap = await within(explainer).findByTestId('cam-heatmap');
    expect(heatmap.querySelectorAll('rect')).toHaveLength(49);
    expect(within(explainer).getByRole('button', { name: 'Nhựa' })).toHaveAttribute('aria-pressed', 'true');

    // Đẳng thức hiển thị: trung bình 49 ô + b = logit (cùng một số ở hai vế)
    const check = within(explainer).getByTestId('cam-check').textContent!;
    const [, sum, logit] = /= (-?[\d,.]+) ≈ logit (-?[\d,.]+)/.exec(check)!;
    const num = (s: string) => Number(s.replace(',', '.'));
    expect(sum).toBe(logit);
    expect(num(within(explainer).getByTestId('path-logit').textContent!)).toBeCloseTo(num(logit!), 3);

    await userEvent.click(within(explainer).getByRole('button', { name: 'Giấy' }));
    expect(within(explainer).getByRole('button', { name: 'Giấy' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('che thử từng ô: đo 49 lần, chỉ ô chứa thông tin làm đổi xác suất', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button', { name: /ảnh lớp giấy, ngăn kiểm tra/i })[0]!);
    const occlusion = await screen.findByTestId('occlusion');
    await userEvent.click(within(occlusion).getByRole('button', { name: /che từng ô \(49 lần\)/i }));
    const grid = await within(occlusion).findByTestId('occlusion-map');
    const values = [...grid.querySelectorAll('rect')].map((r) => Number(r.getAttribute('data-value')));
    expect(values).toHaveLength(49);
    expect(values[0]).not.toBe(0);
    expect(values.slice(1).every((v) => v === 0)).toBe(true);
    // Đổi lớp: cùng 49 lần đo, không phải chạy lại mô hình
    await userEvent.click(screen.getByRole('button', { name: 'Nhựa' }));
    expect(within(occlusion).getByTestId('occlusion-summary')).toHaveTextContent(/Nhựa/);
  });

  test('Chuyên sâu: mở các tầng CNN, xem kênh mạnh nhất và đổi tầng', async () => {
    useModeStore.setState({ mode: 'expert' });
    await seed();
    open();
    await extractAll();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button')[0]!);
    const viewer = await screen.findByTestId('feature-maps');
    await userEvent.click(within(viewer).getByRole('button', { name: 'Mở các tầng của mạng' }));
    expect(await within(viewer).findByTestId('fmap-shape')).toHaveTextContent('Conv1_relu: 112 × 112 ô × 12 kênh');
    expect(within(viewer).getAllByTestId('fmap-channel')).toHaveLength(8);
    expect(within(viewer).getAllByRole('img', { name: /^Kênh / })[0]).toHaveAccessibleName('Kênh 11');
    await userEvent.click(within(viewer).getByRole('button', { name: 'Tầng 5' }));
    expect(within(viewer).getByTestId('fmap-shape')).toHaveTextContent('out_relu: 7 × 7 ô');
    expect(within(viewer).getByText(/1280 con số ở trên/)).toBeInTheDocument();
  });

  test('Khám phá: không hiện trình xem tầng CNN', async () => {
    await seed();
    open();
    await extractAll();
    await userEvent.click(within(screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' })).getAllByRole('button')[0]!);
    await screen.findByTestId('selected-detail');
    expect(screen.queryByTestId('feature-maps')).toBeNull();
  });

  test('UMAP: chuyển cách vẽ, gắn nhãn xấp xỉ, ẩn ranh giới; về PCA như cũ', async () => {
    await seed();
    open();
    await extractAll();
    await userEvent.click(screen.getByRole('button', { name: 'UMAP' }));
    expect(await screen.findByTestId('umap-note', {}, SLOW_WAIT)).toHaveTextContent(/seed 42/);
    // ghi chú hiện ngay, còn bản đồ chỉ hiện khi UMAP tính xong (bất đồng bộ): phải chờ bản đồ
    const map = await screen.findByRole('group', { name: 'Bản đồ dữ liệu 2D' }, SLOW_WAIT);
    expect(within(map).getAllByRole('button')).toHaveLength(16);
    expect(screen.getByText(/UMAP 1 \(không có đơn vị\)/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /hiện ranh giới quyết định/i })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'PCA' }));
    expect(screen.getByTestId('map-kept')).toBeInTheDocument();
  });

  test('ranh giới quyết định 2D: bật thì vẽ lưới và so sánh với mô hình chính', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    await userEvent.click(screen.getByRole('checkbox', { name: /hiện ranh giới quyết định/i }));
    expect(await screen.findByTestId('decision-grid')).toBeInTheDocument();
    expect(screen.getByTestId('decision-grid').querySelectorAll('rect')).toHaveLength(48 * 48);
    expect(screen.getByTestId('boundary-note')).toHaveTextContent(/2 trục đạt 100%.*mô hình chính đạt 100%/);
    await userEvent.click(screen.getByRole('checkbox', { name: /hiện ranh giới quyết định/i }));
    expect(screen.queryByTestId('decision-grid')).toBeNull();
  });

  test('ngưỡng tin cậy: ngưỡng cao hơn thì trả lời ít hơn', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    expect(screen.getByTestId('threshold-summary')).toHaveTextContent('Trả lời 4/4 ảnh (100%)');
    fireEvent.change(screen.getByRole('slider', { name: /ngưỡng/i }), { target: { value: '0.95' } });
    expect(screen.getByRole('slider', { name: /ngưỡng/i })).toHaveValue('0.95');
    expect(screen.getByTestId('threshold-summary').textContent).not.toBe('Trả lời 4/4 ảnh (100%) · đúng 100% trong số đã trả lời');
  });

  test('chỉ có 1 lớp có ảnh Huấn luyện thì chưa huấn luyện được', async () => {
    repos = createTestRepository();
    projectId = (await repos.repository.create({ name: 'Một lớp', projectType: 'image' })).id;
    const c = await repos.dataset.addClass(projectId, 'A');
    await repos.dataset.addClass(projectId, 'B');
    await repos.dataset.addSamples([0, 1].map((n) => ({ projectId, classId: c.id, split: 'train' as const, source: 'upload' as const, image: imageOf(10, n) })));
    open();
    await userEvent.click(await screen.findByRole('button', { name: /biến ảnh thành vector/i }));
    expect(await screen.findByText('Cần ít nhất 2 lớp có ảnh Huấn luyện.')).toBeInTheDocument();
  });
});

describe('Sổ tay: đoán trước, so sau', () => {
  test('mỗi bước có một ô Sổ tay', async () => {
    await seed();
    open();
    await screen.findByText(/cần làm bước 3 \(biểu diễn\) trước/i);
    for (const step of ['data', 'check', 'represent', 'train', 'evaluate', 'use']) {
      expect(screen.getByTestId(`notebook-${step}`)).toBeInTheDocument();
    }
  });

  test('đoán điểm Kiểm tra trước khi huấn luyện: xong thì so với điểm thật và lưu vào nhật ký', async () => {
    useModeStore.setState({ mode: 'expert' });
    await seed();
    open();
    await extractAll();
    const guess = screen.getByLabelText('Em đoán điểm Kiểm tra (%)');
    await userEvent.type(guess, '80');
    await trainToEnd();

    expect(screen.getByTestId('guess-result')).toHaveTextContent('Em đoán 80%. Điểm Kiểm tra thực tế: 100% (lệch 20 điểm).');
    expect(guess).toHaveValue(null);
    await waitFor(async () => expect((await repos.experiments.listRuns(projectId))[0]?.guess).toEqual({ testAccuracy: 0.8 }));
    const log = await screen.findByRole('table', { name: 'Nhật ký thí nghiệm' }, SLOW_WAIT);
    expect(await within(log).findByText('80%')).toBeInTheDocument();
  });

  test('không đoán thì không so; đoán ngoài 0 đến 100 thì chưa cho huấn luyện', async () => {
    await seed();
    open();
    await extractAll();
    const guess = screen.getByLabelText('Em đoán điểm Kiểm tra (%)');
    fireEvent.change(guess, { target: { value: '150' } });
    expect(screen.getByRole('button', { name: 'Bắt đầu huấn luyện' })).toBeDisabled();
    expect(screen.getByText('Điểm đoán phải từ 0 đến 100.')).toBeInTheDocument();

    fireEvent.change(guess, { target: { value: '' } });
    await trainToEnd();
    expect(screen.queryByTestId('guess-result')).toBeNull();
    await waitFor(async () => expect((await repos.experiments.listRuns(projectId))[0]?.guess).toBeUndefined());
  });

  test('chưa có ảnh Kiểm tra thì không hỏi đoán điểm', async () => {
    await seed({ testPerClass: 0 });
    open();
    await userEvent.click(await screen.findByRole('button', { name: /biến ảnh thành vector \(12 ảnh/i }));
    await screen.findByText(/tất cả ảnh đã có vector/i);
    expect(screen.queryByLabelText('Em đoán điểm Kiểm tra (%)')).toBeNull();
  });
});

describe('Thí nghiệm có kiểm soát', () => {
  test('Khám phá: chọn số lượt học Ít / Vừa / Nhiều', async () => {
    await seed();
    open();
    await extractAll();
    expect(screen.getByRole('radio', { name: 'Vừa (50)' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Ít (10)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu huấn luyện' }));
    expect(await screen.findByText('Xong 10 epoch.', {}, SLOW_WAIT)).toBeInTheDocument();
  });

  test('đổi một thứ, huấn luyện lại: thấy đã đổi gì, điểm đổi thế nào, ghi kết luận vào nhật ký', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    const first = await screen.findByTestId('run-comparison', {}, SLOW_WAIT);
    expect(first).toHaveTextContent('Đây là lần chạy đầu tiên.');
    expect(screen.getByTestId('experiment-plan')).toHaveTextContent('Chưa đổi gì so với lần #1.');

    await userEvent.click(screen.getByRole('radio', { name: 'Ít (10)' }));
    expect(screen.getByTestId('experiment-plan')).toHaveTextContent('số epoch 50 → 10');
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện lại' }));
    await screen.findByText('Xong 10 epoch.', {}, SLOW_WAIT);

    const comparison = await screen.findByText('Kết quả so với lần #1', {}, SLOW_WAIT);
    expect(comparison).toBeInTheDocument();
    expect(screen.getByTestId('run-delta')).toHaveTextContent(/^Điểm Kiểm tra: 100% → \d+% \(((tăng|giảm) \d+ điểm|giữ nguyên)\)\.$/);

    await userEvent.type(screen.getByLabelText('Kết luận của em'), 'Ít epoch vẫn đủ');
    await userEvent.tab();
    await waitFor(async () => expect((await repos.experiments.listRuns(projectId))[0]?.conclusion).toBe('Ít epoch vẫn đủ'));

    expect(screen.getByTestId('run-changes-2')).toHaveTextContent('số epoch 50 → 10');
    expect(screen.getByTestId('run-changes-1')).toHaveTextContent('Lần đầu');
    const log = screen.getByRole('table', { name: 'Nhật ký thí nghiệm' });
    expect(await within(log).findByText('Ít epoch vẫn đủ')).toBeInTheDocument();
  });
});

describe('Điểm đáng chú ý ở bước Đánh giá', () => {
  test('đoán đúng hết trên ít ảnh: báo đúng hết và nhắc mỗi ảnh làm điểm đổi nhiều', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    const findings = await screen.findByTestId('findings');
    expect(findings).toHaveTextContent('trên tập Kiểm tra');
    expect(screen.getByTestId('finding-all-correct')).toHaveTextContent('Máy đoán đúng hết 4 ảnh.');
    expect(screen.getByTestId('finding-small-set')).toHaveTextContent('Chỉ có 4 ảnh nên mỗi ảnh làm điểm đổi 25 điểm.');
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện', pressed: false }));
    expect(screen.getByTestId('finding-small-set')).toHaveTextContent('Chỉ có 12 ảnh nên mỗi ảnh làm điểm đổi 8,3 điểm.');
  });

  test('ảnh bị nhầm: chỉ cặp nhầm nhiều nhất và mở đúng ô ma trận', async () => {
    await seed({ confusingTest: true });
    open();
    await extractAll();
    await trainToEnd();
    const top = await screen.findByTestId('finding-top-confusion');
    expect(top).toHaveTextContent('Hay nhầm nhất: 2/2 ảnh Nhựa bị đoán là Giấy.');
    expect(top).toHaveTextContent('Ảnh Nhựa và ảnh Giấy giống nhau ở điểm nào?');

    await userEvent.click(within(top).getByRole('button', { name: 'Xem các ảnh này' }));
    expect(screen.getByRole('button', { name: '2 ảnh lớp Nhựa bị đoán là Giấy' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('cell-samples')).getAllByRole('listitem')).toHaveLength(2);

  });

  test('đổi ma trận sang tập Huấn luyện thì phát hiện tính trên tập đó', async () => {
    await seed({ confusingTest: true });
    open();
    await extractAll();
    await trainToEnd();
    await screen.findByTestId('finding-top-confusion');
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện', pressed: false }));
    expect(screen.getByTestId('findings')).toHaveTextContent('trên tập Huấn luyện');
    expect(screen.getByTestId('finding-all-correct')).toHaveTextContent('Máy đoán đúng hết 12 ảnh.');
  });
});

describe('Vòng cải tiến', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function trainConfusing() {
    await seed({ confusingTest: true });
    open();
    await extractAll();
    await trainToEnd();
    await screen.findByTestId('run-comparison', {}, SLOW_WAIT);
  }

  test('ô nhầm: gợi ý thêm ảnh cho lớp bị nhận sai; tải ảnh vào ngăn Huấn luyện của đúng lớp', async () => {
    await trainConfusing();
    await userEvent.click(screen.getByRole('button', { name: '2 ảnh lớp Nhựa bị đoán là Giấy' }));
    const bar = screen.getByTestId('improve-bar');
    expect(bar).toHaveTextContent('Thêm ảnh Nhựa đa dạng hơn rồi huấn luyện lại, xem máy còn nhầm sang Giấy không.');
    expect(within(bar).getByRole('button', { name: 'Chụp thêm' })).toBeInTheDocument();

    vi.mocked(codec.fileToStoredImage).mockResolvedValueOnce(imageOf(20, 77));
    const file = new File([new Uint8Array([1, 2, 3])], 'nhua.jpg', { type: 'image/jpeg' });
    await userEvent.upload(within(bar).getByLabelText('Tải thêm ảnh Huấn luyện cho lớp Nhựa'), file);

    const nhua = (await repos.dataset.listClasses(projectId)).find((c) => c.name === 'Nhựa')!;
    await waitFor(async () => {
      const added = (await repos.dataset.listSamples(projectId)).filter((x) => x.classId === nhua.id && x.split === 'train');
      expect(added).toHaveLength(7);
    });
  });

  test('ô đúng (đường chéo) thì không gợi ý thêm ảnh', async () => {
    await trainConfusing();
    await userEvent.click(screen.getByRole('button', { name: '2 ảnh lớp Giấy bị đoán là Giấy' }));
    expect(screen.queryByTestId('improve-bar')).toBeNull();
  });

  test('xóa ảnh Kiểm tra sau khi đã huấn luyện: hỏi lại vì điểm không còn so được; không đồng ý thì giữ ảnh', async () => {
    await trainConfusing();
    await userEvent.click(screen.getByRole('button', { name: '2 ảnh lớp Nhựa bị đoán là Giấy' }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(within(screen.getByTestId('cell-samples')).getAllByRole('button', { name: 'Xóa ảnh này' })[0]!);
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining('không còn so được với các lần trước')));
    expect(await repos.dataset.listSamples(projectId)).toHaveLength(16);

    confirm.mockReturnValue(true);
    await userEvent.click(within(screen.getByTestId('cell-samples')).getAllByRole('button', { name: 'Xóa ảnh này' })[0]!);
    await waitFor(async () => expect(await repos.dataset.listSamples(projectId)).toHaveLength(15));
  });

  test('chuyển ảnh Kiểm tra sang Huấn luyện sau khi đã huấn luyện: cảnh báo đổi "đề thi", đồng ý một lần thì không hỏi lại', async () => {
    await trainConfusing();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(screen.getAllByRole('tab', { name: 'Kiểm tra (2)' })[0]!);
    await userEvent.click(screen.getAllByRole('button', { name: /^Chuyển sang Huấn luyện: / })[0]!);
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining('điểm sẽ đẹp hơn thực tế')));
    const countTest = async () => (await repos.dataset.listSamples(projectId)).filter((x) => x.split === 'test').length;
    expect(await countTest()).toBe(4);

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getAllByRole('button', { name: /^Chuyển sang Huấn luyện: / })[0]!);
    await waitFor(async () => expect(await countTest()).toBe(3));
    // Đợi giao diện tải lại (tab còn 1 ảnh Kiểm tra) rồi mới chuyển tiếp ảnh còn lại.
    await screen.findByRole('tab', { name: 'Kiểm tra (1)' });
    await userEvent.click(screen.getAllByRole('button', { name: /^Chuyển sang Huấn luyện: / })[0]!);
    await waitFor(async () => expect(await countTest()).toBe(2));
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  test('huấn luyện lại: bảng tỉ lệ nhận ra từng lớp trước / sau', async () => {
    await trainConfusing();
    await userEvent.click(screen.getByRole('radio', { name: 'Ít (10)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện lại' }));
    await screen.findByText('Kết quả so với lần #1', {}, SLOW_WAIT);
    const table = await screen.findByTestId('class-recall', {}, SLOW_WAIT);
    expect(within(table).getByRole('columnheader', { name: 'Lần #1' })).toBeInTheDocument();
    // 50 epoch: ảnh Nhựa (trông giống Giấy) bị nhận sai hết; 10 epoch: máy nghiêng hẳn về Nhựa.
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'LớpLần #1Lần #2',
      'Nhựa0%100% (tăng)',
      'Giấy100%0% (giảm)',
    ]);
    expect((await repos.experiments.listRuns(projectId))[0]?.classRecall).toEqual([1, 0]);
  });
});

describe('Bước 6: Sử dụng', () => {
  test('sau khi huấn luyện: tải một ảnh mới, mô hình đoán lớp; ảnh thử không được lưu vào dự án', async () => {
    await seed();
    open();
    const use = await screen.findByRole('region', { name: /^Sử dụng/ });
    expect(within(use).getByText(/huấn luyện mô hình ở bước 4/i)).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Các bước của dự án' })).getAllByRole('listitem')).toHaveLength(6);

    await extractAll();
    await trainToEnd();
    vi.mocked(codec.fileToStoredImage).mockResolvedValueOnce(imageOf(230, 3));
    await userEvent.upload(within(use).getByLabelText('Tải một ảnh lên để thử'), new File(['x'], 'moi.jpg', { type: 'image/jpeg' }));

    expect(await within(use).findByTestId('probe-verdict')).toHaveTextContent('Giấy');
    expect(within(use).getByTestId('probe-marker')).toBeInTheDocument();
    expect(within(use).getByText(/đang dùng mô hình ở epoch 50/i)).toBeInTheDocument();
    expect(await repos.dataset.listSamples(projectId)).toHaveLength(16);
  });
});
