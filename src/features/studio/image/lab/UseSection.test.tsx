import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord, StoredImage } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import * as codec from '../image-codec.browser';
import { UseSection } from './UseSection';

/** Ảnh giả: byte 0 = "màu". Vector đặc trưng = [màu/255, 1 − màu/255] → màu tối = lớp 0, sáng = lớp 1. */
const imageOf = (tone: number): StoredImage => ({ bytes: new Uint8Array([tone]).buffer, mime: 'image/jpeg', width: 224, height: 224 });
const DIM = 1280;
const vectorOf = (tone: number) => {
  const v = new Float32Array(DIM);
  v[0] = tone / 255;
  v[1] = 1 - tone / 255;
  return v;
};

vi.mock('../image-codec.browser', () => ({
  fileToStoredImage: vi.fn(),
  videoFrameToStoredImage: vi.fn(),
  decodeStoredImage: vi.fn(async (img: StoredImage) => {
    const data = new Uint8ClampedArray(224 * 224 * 4);
    data[0] = new Uint8Array(img.bytes)[0]!;
    return { width: 224, height: 224, data };
  }),
}));

vi.mock('../feature-loader.browser', () => ({
  loadFeatureExtractor: vi.fn(async () => ({
    modelId: 'test',
    dispose: () => undefined,
    extract: async (images: { data: Uint8ClampedArray }[]) => images.map((img) => vectorOf(img.data[0]!)),
    extractSpatial: async (images: { data: Uint8ClampedArray }[]) =>
      images.map((img) => {
        const out = new Float32Array(49 * DIM);
        for (let cell = 0; cell < 49; cell++) out.set(vectorOf(img.data[0]!), cell * DIM);
        return out;
      }),
  })),
}));

const classes: ClassRecord[] = [
  { id: 'c0', projectId: 'p', name: 'Nhựa', order: 0, createdAt: '' },
  { id: 'c1', projectId: 'p', name: 'Giấy', order: 1, createdAt: '' },
];
const samples: SampleRecord[] = [20, 40, 210, 230].map((tone, i) => ({
  id: `s${i}`,
  projectId: 'p',
  classId: i < 2 ? 'c0' : 'c1',
  split: 'train',
  source: 'upload',
  image: imageOf(tone),
  createdAt: '',
}));
const features = new Map(samples.map((s, i) => [s.id, vectorOf([20, 40, 210, 230][i]!)]));
/** Logit "Nhựa" = 8 × (1 − màu), logit "Giấy" = 8 × màu → ảnh rất tối / rất sáng thì chắc chắn, ảnh xám thì phân vân. */
const weights = new Float32Array(2 * DIM);
weights[1] = 8;
weights[DIM] = 8;
const params: SoftmaxParams = { numClasses: 2, dim: DIM, weights, bias: new Float32Array(2) };

function renderUse(overrides: Partial<Parameters<typeof UseSection>[0]> = {}) {
  return render(<UseSection classes={classes} samples={samples} features={features} params={params} epoch={49} {...overrides} />);
}

function mockCamera() {
  const stop = vi.fn();
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  return { stop, getUserMedia, pause };
}

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
  vi.mocked(codec.fileToStoredImage).mockReset();
  vi.mocked(codec.videoFrameToStoredImage).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('⑥ Sử dụng (Studio ảnh)', () => {
  test('chưa có mô hình thì hướng dẫn quay lại bước ④, không bật camera', () => {
    const { getUserMedia } = mockCamera();
    renderUse({ params: null, epoch: null });
    expect(screen.getByRole('heading', { name: /⑥ Sử dụng/ })).toBeInTheDocument();
    expect(screen.getByText(/huấn luyện mô hình ở bước ④/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bật camera/i })).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  test('tải một ảnh mới: đoán lớp, đặt ✱ lên bản đồ, chỉ ra ảnh Dạy giống nhất và giải thích', async () => {
    vi.mocked(codec.fileToStoredImage).mockResolvedValue(imageOf(240));
    renderUse();
    const input = screen.getByLabelText(/tải một ảnh lên để thử/i);
    await userEvent.upload(input, new File(['x'], 'moi.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByTestId('probe-verdict')).toHaveTextContent(/Giấy/);
    expect(screen.getByTestId('probe-verdict')).toHaveTextContent(/\d+(,\d)?%/);
    // ảnh thử không bao giờ được làm mờ / lưu: gọi không kèm tùy chọn làm mờ
    expect(codec.fileToStoredImage).toHaveBeenCalledWith(expect.any(File));
    expect(screen.getByTestId('probe-marker')).toHaveAccessibleName(/ảnh đang thử.*Giấy/i);
    const neighbors = screen.getByRole('list', { name: /ảnh dạy giống nhất/i });
    expect(within(neighbors).getAllByRole('listitem')[0]).toHaveTextContent('Giấy');
    expect(await screen.findByTestId('cam-heatmap')).toBeInTheDocument();
    expect(screen.getByText(/không được lưu vào dự án/i)).toBeInTheDocument();
  });

  test('tệp không phải ảnh thì báo lỗi rõ ràng, không đoán', async () => {
    renderUse();
    const input = screen.getByLabelText(/tải một ảnh lên để thử/i);
    await userEvent.upload(input, new File(['x'], 'bai.txt', { type: 'text/plain' }), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(/sai định dạng/i);
    expect(screen.queryByTestId('probe-verdict')).toBeNull();
    expect(codec.fileToStoredImage).not.toHaveBeenCalled();
  });

  test('ảnh phân vân (xác suất cao nhất dưới 60%) thì nói rõ mô hình chưa chắc chắn', async () => {
    vi.mocked(codec.fileToStoredImage).mockResolvedValue(imageOf(128));
    renderUse();
    await userEvent.upload(screen.getByLabelText(/tải một ảnh lên để thử/i), new File(['x'], 'xam.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByTestId('probe-uncertain')).toHaveTextContent(/chưa chắc chắn/i);
  });

  test('webcam: nhận dạng liên tục; Dừng hình thì đứng yên và giải thích; Chạy tiếp; tắt camera khi đóng', async () => {
    const { stop, pause } = mockCamera();
    let tone = 20;
    vi.mocked(codec.videoFrameToStoredImage).mockImplementation(async () => imageOf(tone));
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    const user = userEvent.setup();
    const { unmount } = renderUse();

    await user.click(screen.getByRole('button', { name: /bật camera/i }));
    expect(await screen.findByTestId('probe-verdict')).toHaveTextContent(/Nhựa/);
    // khung hình đổi → câu trả lời đổi theo, không cần bấm gì
    tone = 235;
    await waitFor(() => expect(screen.getByTestId('probe-verdict')).toHaveTextContent(/Giấy/));
    // ảnh webcam thử cũng không làm mờ / không lưu
    expect(codec.videoFrameToStoredImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement));
    expect(screen.queryByTestId('cam-heatmap')).toBeNull(); // giải thích nặng chỉ chạy khi dừng hình

    await user.click(screen.getByRole('button', { name: /dừng hình/i }));
    expect(await screen.findByTestId('cam-heatmap')).toBeInTheDocument();
    expect(pause).toHaveBeenCalled(); // hình trên màn đứng yên, khớp với phần giải thích
    const calls = vi.mocked(codec.videoFrameToStoredImage).mock.calls.length;
    tone = 20;
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(codec.videoFrameToStoredImage).toHaveBeenCalledTimes(calls);
    expect(screen.getByTestId('probe-verdict')).toHaveTextContent(/Giấy/);

    await user.click(screen.getByRole('button', { name: /chạy tiếp/i }));
    await waitFor(() => expect(screen.getByTestId('probe-verdict')).toHaveTextContent(/Nhựa/));

    unmount();
    expect(stop).toHaveBeenCalled();
  });

  test('chưa cho phép dùng camera thì hướng dẫn, và gợi ý tải ảnh lên', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => Promise.reject(new DOMException('no', 'NotAllowedError'))) },
    });
    renderUse();
    await userEvent.click(screen.getByRole('button', { name: /bật camera/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/chưa cho phép dùng camera/i);
    expect(screen.getByLabelText(/tải một ảnh lên để thử/i)).toBeInTheDocument();
  });

  test('webcam chưa có kích thước khung hình thì chờ, không báo lỗi giả', async () => {
    mockCamera();
    const width = vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(0);
    vi.mocked(codec.videoFrameToStoredImage).mockImplementation(async () => imageOf(20));
    renderUse();
    await userEvent.click(screen.getByRole('button', { name: /bật camera/i }));
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(codec.videoFrameToStoredImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    width.mockReturnValue(640);
    expect(await screen.findByTestId('probe-verdict')).toHaveTextContent(/Nhựa/);
  });

  test('ảnh tải lên xử lý xong muộn thì không ghi đè: ảnh sau thắng, bật camera thì bỏ kết quả cũ', async () => {
    const pending: ((img: StoredImage) => void)[] = [];
    vi.mocked(codec.fileToStoredImage).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    renderUse();
    const input = screen.getByLabelText(/tải một ảnh lên để thử/i);
    await userEvent.upload(input, new File(['a'], 'a.jpg', { type: 'image/jpeg' }));
    await userEvent.upload(input, new File(['b'], 'b.jpg', { type: 'image/jpeg' }));
    await act(async () => pending[1]!(imageOf(235))); // ảnh B (Giấy) xong trước
    expect(await screen.findByTestId('probe-verdict')).toHaveTextContent(/Giấy/);
    await act(async () => pending[0]!(imageOf(20))); // ảnh A (Nhựa) xong sau: phải bị bỏ qua
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.getByTestId('probe-verdict')).toHaveTextContent(/Giấy/);

    mockCamera();
    vi.mocked(codec.videoFrameToStoredImage).mockImplementation(() => new Promise(() => undefined)); // camera chưa có khung nào
    await userEvent.upload(input, new File(['c'], 'c.jpg', { type: 'image/jpeg' }));
    await userEvent.click(screen.getByRole('button', { name: /bật camera/i }));
    await act(async () => pending[2]!(imageOf(235)));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(screen.queryByTestId('probe-verdict')).toBeNull();
  });

  test('tắt camera thì xóa luôn thông báo lỗi của khung hình', async () => {
    mockCamera();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(640);
    vi.mocked(codec.videoFrameToStoredImage).mockRejectedValue(new Error('hỏng'));
    renderUse();
    await userEvent.click(screen.getByRole('button', { name: /bật camera/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/không phân tích được ảnh/i);
    await userEvent.click(screen.getByRole('button', { name: 'Tắt camera' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
