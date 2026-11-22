import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { FEATURE_MODEL_ID } from '@/core/ml/feature-model';
import { useModeStore } from '@/ui/mode-store';
import type { StoredImage } from '@/storage/db';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../../tests/setup/render';
import * as loader from '../feature-loader.browser';

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
vi.setConfig({ testTimeout: 20_000 });

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
  await screen.findByText('Xong 50 epoch.', {}, { timeout: 10_000 });
}

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
});

describe('③ Biểu diễn', () => {
  test('trích đặc trưng, lưu cache và vẽ bản đồ PCA với mọi ảnh', async () => {
    await seed();
    open();
    expect(await screen.findByText(/hãy làm bước ③ biểu diễn trước/i)).toBeInTheDocument();
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

  test('bấm một chấm: xem 1280 con số và các ảnh Dạy giống nhất', async () => {
    await seed();
    open();
    await extractAll();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button', { name: /ảnh lớp nhựa, ngăn dạy/i })[0]!);
    const detail = await screen.findByTestId('selected-detail');
    expect(within(detail).getByTestId('feature-strip').querySelectorAll('rect')).toHaveLength(1280);
    expect(within(detail).getByText(/ảnh dạy giống nhất/i)).toBeInTheDocument();
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

describe('④ Huấn luyện và ⑤ Đánh giá', () => {
  test('huấn luyện, xem điểm Dạy / Kiểm tra và ma trận nhầm lẫn bấm được', async () => {
    await seed();
    open();
    expect(await screen.findByText('Hãy huấn luyện ở bước ④ trước.')).toBeInTheDocument();
    await extractAll();
    await trainToEnd();
    expect(screen.getByTestId('score-train')).toHaveTextContent('100%');
    expect(screen.getByTestId('score-test')).toHaveTextContent('100%');

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
    expect(await screen.findByText('Xong 50 epoch.', {}, { timeout: 10_000 })).toBeInTheDocument();
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
    await screen.findByText('Xong 5 epoch.', {}, { timeout: 10_000 });
    expect(screen.getByRole('table', { name: 'Theo từng lớp' })).toBeInTheDocument();
  });

  test('thêm lớp sau khi huấn luyện: yêu cầu huấn luyện lại', async () => {
    await seed();
    open();
    await extractAll();
    await trainToEnd();
    await userEvent.type(screen.getByLabelText('Tên lớp mới'), 'Kim loại{Enter}');
    expect(await screen.findByText(/các lớp đã thay đổi/i)).toBeInTheDocument();
    expect(screen.getByText('Hãy huấn luyện ở bước ④ trước.')).toBeInTheDocument();
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
    await screen.findByText('Xong 50 epoch.', {}, { timeout: 10_000 });
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
    await screen.findByText('Xong 50 epoch.', {}, { timeout: 10_000 });
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
    expect(screen.getByText('Hãy huấn luyện ở bước ④ trước.')).toBeInTheDocument();
  });

  test('chưa huấn luyện: phần giải thích nhắc huấn luyện trước', async () => {
    await seed();
    open();
    await extractAll();
    const map = screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
    await userEvent.click(within(map).getAllByRole('button')[0]!);
    expect(await screen.findByText('Hãy huấn luyện ở bước ④ để xem giải thích.')).toBeInTheDocument();
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
    expect(within(explainer).getByRole('button', { name: /● Nhựa/ })).toHaveAttribute('aria-pressed', 'true');

    // Đẳng thức hiển thị: trung bình 49 ô + b = logit (cùng một số ở hai vế)
    const check = within(explainer).getByTestId('cam-check').textContent!;
    const [, sum, logit] = /= (-?[\d,.]+) ≈ logit (-?[\d,.]+)/.exec(check)!;
    const num = (s: string) => Number(s.replace(',', '.'));
    expect(sum).toBe(logit);
    expect(num(within(explainer).getByTestId('path-logit').textContent!)).toBeCloseTo(num(logit!), 3);

    await userEvent.click(within(explainer).getByRole('button', { name: /▲ Giấy/ }));
    expect(within(explainer).getByRole('button', { name: /▲ Giấy/ })).toHaveAttribute('aria-pressed', 'true');
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
    await userEvent.click(screen.getByRole('button', { name: /● Nhựa/ }));
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
    expect(await screen.findByTestId('umap-note', {}, { timeout: 10_000 })).toHaveTextContent(/seed 42/);
    expect(within(screen.getByRole('group', { name: 'Bản đồ dữ liệu 2D' })).getAllByRole('button')).toHaveLength(16);
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
    expect(screen.getByTestId('boundary-note')).toHaveTextContent(/2 trục đạt 100% .* mô hình chính .* đạt 100%/);
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

  test('chỉ có 1 lớp có ảnh Dạy thì chưa huấn luyện được', async () => {
    repos = createTestRepository();
    projectId = (await repos.repository.create({ name: 'Một lớp', projectType: 'image' })).id;
    const c = await repos.dataset.addClass(projectId, 'A');
    await repos.dataset.addClass(projectId, 'B');
    await repos.dataset.addSamples([0, 1].map((n) => ({ projectId, classId: c.id, split: 'train' as const, source: 'upload' as const, image: imageOf(10, n) })));
    open();
    await userEvent.click(await screen.findByRole('button', { name: /biến ảnh thành vector/i }));
    expect(await screen.findByText('Cần ít nhất 2 lớp có ảnh Dạy.')).toBeInTheDocument();
  });
});

