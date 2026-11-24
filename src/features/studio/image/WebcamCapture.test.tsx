import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { StoredImage } from '@/storage/db';
import { FaceBlurError } from './face-blur-error';
import { WebcamCapture } from './WebcamCapture';

const IMAGE: StoredImage = { bytes: new Uint8Array([1]).buffer, mime: 'image/jpeg', width: 224, height: 224 };

function mockCamera() {
  const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
}

describe('WebcamCapture', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    mockCamera();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('đang xử lý một khung hình (làm mờ chậm) thì bấm thêm không chạy chồng; xong mới chụp tiếp', async () => {
    const user = userEvent.setup();
    let release: (image: StoredImage) => void = () => undefined;
    const captureFrame = vi.fn(() => new Promise<StoredImage>((resolve) => (release = resolve)));
    render(<WebcamCapture title="Lớp 1" remaining={10} captureFrame={captureFrame} onDone={vi.fn()} />);
    const snap = await screen.findByRole('button', { name: 'Chụp 1 ảnh' });
    await waitFor(() => expect(snap).toBeEnabled());

    await user.click(snap);
    expect(snap).toBeDisabled();
    await user.click(snap);
    expect(captureFrame).toHaveBeenCalledTimes(1);
    await act(async () => release(IMAGE));
    expect(await screen.findByText('Đã chụp 1 ảnh')).toBeInTheDocument();
    expect(snap).toBeEnabled();

    await user.click(snap);
    expect(captureFrame).toHaveBeenCalledTimes(2);
    await act(async () => release(IMAGE));
    expect(await screen.findByText('Đã chụp 2 ảnh')).toBeInTheDocument();
  });

  test('không làm mờ được khuôn mặt thì báo rõ, khung hình không được giữ lại', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const captureFrame = vi.fn().mockRejectedValueOnce(new FaceBlurError('mô hình')).mockResolvedValueOnce(IMAGE);
    render(<WebcamCapture title="Lớp 1" remaining={10} captureFrame={captureFrame} onDone={onDone} />);
    const snap = await screen.findByRole('button', { name: 'Chụp 1 ảnh' });
    await waitFor(() => expect(snap).toBeEnabled());

    await user.click(snap);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không làm mờ được khuôn mặt nên chưa lưu ảnh này');
    expect(screen.getByText('Đã chụp 0 ảnh')).toBeInTheDocument();
    await waitFor(() => expect(snap).toBeEnabled());

    await user.click(snap);
    expect(await screen.findByText('Đã chụp 1 ảnh')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Xong' }));
    expect(onDone).toHaveBeenCalledWith([IMAGE]);
  });
});
