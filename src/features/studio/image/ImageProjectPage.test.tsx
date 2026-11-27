import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { useModeStore } from '@/ui/mode-store';
import type { StoredImage } from '@/storage/db';
import { createTestRepository, renderApp, type TestRepositories } from '../../../../tests/setup/render';
import * as codec from './image-codec.browser';
import { FaceBlurError } from './face-blur-error';
import { useStepDetailsStore } from '@/features/studio/step-details';

const FAKE_IMAGE: StoredImage = { bytes: new Uint8Array([9]).buffer, mime: 'image/jpeg', width: 224, height: 224 };

vi.mock('./image-codec.browser', () => ({
  fileToStoredImage: vi.fn(async () => FAKE_IMAGE),
  videoFrameToStoredImage: vi.fn(async () => FAKE_IMAGE),
  decodeStoredImage: vi.fn(async () => {
    const data = new Uint8ClampedArray(224 * 224 * 4);
    for (let i = 0; i < 224 * 224; i++) data.set([200, 100, 50, 255], i * 4);
    return { width: 224, height: 224, data };
  }),
}));

let repos: TestRepositories;
let projectId: string;
let classIds: string[];

async function seed(trainPerClass = 0, testPerClass = 0) {
  repos = createTestRepository();
  const project = await repos.repository.create({ name: 'Phân loại rác', projectType: 'image' });
  projectId = project.id;
  const a = await repos.dataset.addClass(projectId, 'Nhựa');
  const b = await repos.dataset.addClass(projectId, 'Giấy');
  classIds = [a.id, b.id];
  for (const classId of classIds) {
    const make = (split: 'train' | 'test', n: number) =>
      Array.from({ length: n }, () => ({ projectId, classId, split, source: 'upload' as const, image: FAKE_IMAGE }));
    await repos.dataset.addSamples([...make('train', trainPerClass), ...make('test', testPerClass)]);
  }
}

function openProject() {
  return renderApp(`/studio/${projectId}`, repos.repository, repos.dataset);
}

function panel(name: string) {
  return screen.getByRole('article', { name });
}

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
  useStepDetailsStore.setState({ isOpen: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Trang dự án ảnh', () => {
  test('dự án không tồn tại', async () => {
    repos = createTestRepository();
    renderApp('/studio/khong-co', repos.repository, repos.dataset);
    expect(await screen.findByRole('alert')).toHaveTextContent(/không tìm thấy dự án/i);
  });

  test('hiển thị các lớp, bước quy trình và cảnh báo lớp rỗng', async () => {
    await seed();
    openProject();
    expect(await screen.findByRole('heading', { level: 1, name: 'Phân loại rác' })).toBeInTheDocument();
    expect(panel('Nhựa')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Các bước của dự án' })).toBeInTheDocument();
    expect(screen.getByText('Lớp "Nhựa" chưa có ảnh Huấn luyện nào.')).toBeInTheDocument();
  });

  test('dữ liệu đủ và cân bằng thì trợ lý báo ổn', async () => {
    await seed(10, 2);
    openProject();
    expect(await screen.findByText(/dữ liệu ổn/i)).toBeInTheDocument();
  });

  test('chế độ Khám phá có gợi ý, chế độ Chuyên sâu ẩn gợi ý', async () => {
    await seed(3, 0);
    openProject();
    expect(await screen.findAllByText(/chụp thêm ở nhiều góc/i)).not.toHaveLength(0);
    useModeStore.setState({ mode: 'expert' });
    await waitFor(() => expect(screen.queryByText(/chụp thêm ở nhiều góc/i)).toBeNull());
  });

  test('thêm lớp một chạm: tên "Lớp n" tăng dần, không cần gõ tên trước; đổi tên sau bằng nút bút chì', async () => {
    await seed();
    openProject();
    const data = await screen.findByRole('region', { name: 'Dữ liệu' });
    expect(within(data).queryByRole('textbox')).toBeNull();
    await userEvent.click(within(data).getByRole('button', { name: 'Thêm lớp' }));
    expect(await screen.findByRole('article', { name: 'Lớp 3' })).toBeInTheDocument();
    await userEvent.click(within(data).getByRole('button', { name: 'Thêm lớp' }));
    expect(await screen.findByRole('article', { name: 'Lớp 4' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('article', { name: 'Lớp 4' })).getByRole('button', { name: 'Đổi tên lớp Lớp 4' }));
    const input = screen.getByLabelText('Tên lớp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Kim loại{Enter}');
    expect(await screen.findByRole('article', { name: 'Kim loại' })).toBeInTheDocument();
  });

  test('tải ảnh lên: nhận ảnh hợp lệ, báo tệp bị bỏ qua và lý do', async () => {
    await seed();
    openProject();
    await screen.findByRole('article', { name: 'Nhựa' });
    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.txt', { type: 'text/plain' }),
    ];
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), { target: { files } });
    expect(await screen.findByText(/đã thêm 1 ảnh vào lớp "nhựa".*bỏ qua 1 tệp: sai định dạng/i)).toBeInTheDocument();
    // Thông báo hiện trước khi danh sách ảnh tải lại xong (máy CI chậm) → chờ danh sách cập nhật.
    await waitFor(() => expect(within(panel('Nhựa')).getAllByRole('listitem')).toHaveLength(1));
  });

  test('ảnh không giải mã được thì báo lỗi', async () => {
    vi.mocked(codec.fileToStoredImage).mockRejectedValueOnce(new Error('hỏng'));
    await seed();
    openProject();
    await screen.findByRole('article', { name: 'Nhựa' });
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), {
      target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/không đọc được ảnh/i);
  });

  test('làm mờ khuôn mặt: mặc định bật, ảnh tải lên được làm mờ; tắt thì nhớ cho dự án này', async () => {
    window.localStorage.clear();
    await seed();
    const view = openProject();
    await screen.findByRole('article', { name: 'Nhựa' });
    const toggle = screen.getByRole('checkbox', { name: 'Làm mờ khuôn mặt trước khi lưu ảnh' });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/ảnh chưa làm mờ không được lưu/);
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), { target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(codec.fileToStoredImage).toHaveBeenLastCalledWith(expect.any(File), expect.objectContaining({ blurFaces: true })));

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    view.unmount();
    openProject();
    expect(await screen.findByRole('checkbox', { name: 'Làm mờ khuôn mặt trước khi lưu ảnh' })).not.toBeChecked();
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), { target: { files: [new File(['b'], 'b.png', { type: 'image/png' })] } });
    await waitFor(() => expect(codec.fileToStoredImage).toHaveBeenLastCalledWith(expect.any(File), expect.objectContaining({ blurFaces: false })));
    window.localStorage.clear();
  });

  test('sau khi tải ảnh lên báo số khuôn mặt đã làm mờ, hoặc cảnh báo khi không thấy khuôn mặt nào', async () => {
    window.localStorage.clear();
    const withFaces = async (_file: Blob, options?: { onFaces?: (n: number) => void }) => {
      options?.onFaces?.(1);
      return FAKE_IMAGE;
    };
    vi.mocked(codec.fileToStoredImage).mockImplementationOnce(withFaces).mockImplementationOnce(withFaces);
    await seed();
    openProject();
    await screen.findByRole('article', { name: 'Nhựa' });
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), { target: { files } });
    expect(await screen.findByText(/đã thêm 2 ảnh.*đã làm mờ 2 khuôn mặt\./i)).toBeInTheDocument();

    vi.mocked(codec.fileToStoredImage).mockImplementationOnce(async (_file, options) => {
      options?.onFaces?.(0);
      return FAKE_IMAGE;
    });
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), { target: { files: [new File(['c'], 'c.png', { type: 'image/png' })] } });
    expect(await screen.findByText(/Không thấy khuôn mặt nào để làm mờ/)).toBeInTheDocument();
  });

  test('không làm mờ được khuôn mặt thì không lưu ảnh và báo rõ lý do', async () => {
    vi.mocked(codec.fileToStoredImage).mockRejectedValueOnce(new FaceBlurError('mô hình'));
    await seed();
    openProject();
    await screen.findByRole('article', { name: 'Nhựa' });
    fireEvent.change(screen.getByTestId(`upload-${classIds[0]}`), { target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/không làm mờ được khuôn mặt nên không lưu/i);
    expect(within(panel('Nhựa')).queryAllByRole('listitem')).toHaveLength(0);
  });

  test('chuyển ảnh sang ngăn Kiểm tra rồi xóa ảnh', async () => {
    await seed(1, 0);
    openProject();
    await userEvent.click(await within(await screen.findByRole('article', { name: 'Nhựa' })).findByRole('button', { name: /chuyển sang kiểm tra/i }));
    await waitFor(async () => expect((await repos.dataset.countSamples(projectId))[classIds[0]!]).toEqual({ train: 0, test: 1 }));
    await userEvent.click(within(panel('Nhựa')).getByRole('tab', { name: /kiểm tra/i }));
    await userEvent.click(within(panel('Nhựa')).getByRole('button', { name: /xóa ảnh/i }));
    await waitFor(async () => expect(await repos.dataset.listSamples(projectId)).toHaveLength(1));
  });

  test('tự chia Huấn luyện / Kiểm tra theo tỉ lệ 80/20', async () => {
    await seed(10, 0);
    openProject();
    await userEvent.click(await screen.findByRole('button', { name: /tự chia/i }));
    // Chạy cả bộ song song thì ghi 20 ảnh + nạp lại có thể quá 1 giây mặc định.
    expect(await screen.findByText('Đã chia lại: 16 ảnh Huấn luyện, 4 ảnh Kiểm tra.', {}, { timeout: 5_000 })).toBeInTheDocument();
  });

  test('đổi tên lớp', async () => {
    await seed();
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Đổi tên lớp Nhựa' }));
    const input = screen.getByLabelText('Tên lớp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Chai nhựa{Enter}');
    expect(await screen.findByRole('article', { name: 'Chai nhựa' })).toBeInTheDocument();
  });

  test('đổi tên trùng thì báo lỗi và giữ ô nhập', async () => {
    await seed();
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Đổi tên lớp Nhựa' }));
    const input = screen.getByLabelText('Tên lớp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Giấy{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/đã có/i);
    expect(screen.getByLabelText('Tên lớp')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('Tên lớp')).toBeNull();
    expect(await screen.findByRole('article', { name: 'Nhựa' })).toBeInTheDocument();
  });

  test('đổi tên lớp rồi bấm ra ngoài thì tự lưu, không cần nút Lưu', async () => {
    await seed();
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Đổi tên lớp Nhựa' }));
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
    const input = screen.getByLabelText('Tên lớp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Chai nhựa');
    await userEvent.click(document.body);
    expect(await screen.findByRole('article', { name: 'Chai nhựa' })).toBeInTheDocument();
  });

  test('xóa lớp sau khi xác nhận', async () => {
    await seed(2, 0);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Xóa lớp Nhựa' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Nhựa' })).toBeNull());
  });

  test('soi ảnh: hiển thị giá trị điểm ảnh thật, chế độ Chuyên sâu có giá trị chuẩn hóa', async () => {
    await seed(1, 0);
    openProject();
    await userEvent.click(await within(await screen.findByRole('article', { name: 'Nhựa' })).findByRole('button', { name: /soi ảnh/i }));
    const dialog = await screen.findByRole('dialog', { name: /kính hiển vi/i });
    expect(await within(dialog).findByTestId('pixel-r')).toHaveTextContent('200');
    expect(within(dialog).getByTestId('pixel-b')).toHaveTextContent('50');
    expect(within(dialog).getByText('Chính xác')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('gridcell')).toHaveLength(49);

    useModeStore.setState({ mode: 'expert' });
    expect(await within(dialog).findByText('→ 0,569')).toBeInTheDocument(); // 200 / 127,5 − 1

    fireEvent.keyDown(within(dialog).getByRole('img'), { key: 'ArrowRight' });
    expect(within(dialog).getByRole('heading', { name: 'Điểm ảnh (113, 112)' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('ảnh từ bộ dữ liệu có giấy phép mở: Kính hiển vi ghi tác giả, nguồn và giấy phép', async () => {
    repos = createTestRepository();
    const project = await repos.repository.create({ name: 'Hoa', projectType: 'image' });
    projectId = project.id;
    const cls = await repos.dataset.addClass(projectId, 'Nhựa');
    const credit = { author: 'Nguyễn A', source: 'https://www.flickr.com/photos/a/1/', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/' };
    await repos.dataset.addSamples([{ projectId, classId: cls.id, split: 'train', source: 'dataset', image: FAKE_IMAGE, credit }]);
    openProject();
    await userEvent.click(await within(await screen.findByRole('article', { name: 'Nhựa' })).findByRole('button', { name: /soi ảnh/i }));
    const line = await within(await screen.findByRole('dialog', { name: /kính hiển vi/i })).findByTestId('image-credit');
    expect(within(line).getByRole('link', { name: 'Nguyễn A' })).toHaveAttribute('href', credit.source);
    expect(within(line).getByRole('link', { name: 'CC BY 2.0' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(line).toHaveTextContent(/đã cắt vuông, thu nhỏ/);
  });

  test('soi ảnh lỗi giải mã', async () => {
    vi.mocked(codec.decodeStoredImage).mockRejectedValueOnce(new Error('x'));
    await seed(1, 0);
    openProject();
    await userEvent.click(await within(await screen.findByRole('article', { name: 'Nhựa' })).findByRole('button', { name: /soi ảnh/i }));
    expect(await screen.findByText('Không đọc được ảnh này.')).toBeInTheDocument();
  });
});

describe('Thu ảnh bằng webcam', () => {
  test('chụp ảnh, lưu vào lớp và tắt camera khi xong', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    });
    await seed();
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Webcam' }));
    const dialog = await screen.findByRole('dialog');
    const snap = within(dialog).getByRole('button', { name: 'Chụp 1 ảnh' });
    await waitFor(() => expect(snap).toBeEnabled());
    await userEvent.click(snap);
    expect(await within(dialog).findByText('Đã chụp 1 ảnh')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xong' }));
    expect(await screen.findByText(/đã thêm 1 ảnh vào lớp "nhựa"/i)).toBeInTheDocument();
    expect(stop).toHaveBeenCalled();
  });

  test('báo lỗi thân thiện khi chưa cấp quyền camera', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => Promise.reject(new DOMException('no', 'NotAllowedError'))) },
    });
    await seed();
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Webcam' }));
    expect(await screen.findByText(/chưa cho phép dùng camera/i)).toBeInTheDocument();
  });

  test('trình duyệt không hỗ trợ camera', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await seed();
    openProject();
    await userEvent.click(within(await screen.findByRole('article', { name: 'Nhựa' })).getByRole('button', { name: 'Webcam' }));
    expect(await screen.findByText(/không tìm thấy camera/i)).toBeInTheDocument();
  });
});
