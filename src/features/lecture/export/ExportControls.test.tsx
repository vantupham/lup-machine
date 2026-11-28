import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import i18n from '@/i18n';
import type { LectureScript } from '../lecture-script';
import { buildTimeline } from '../script-timeline';
import { frameLayout } from '../render/frame-layout';
import { ExportControls } from './ExportControls';
import { MP4_FORMAT } from './export-plan';
import type { ExportRequest } from './export-video.browser';

const exporter = vi.hoisted(() => ({
  pickWebCodecsFormat: vi.fn(),
  canRecordRealtime: vi.fn(),
  exportWithWebCodecs: vi.fn(),
  exportRealtime: vi.fn(),
}));
vi.mock('./export-video.browser', () => exporter);

const download = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock('@/ui/download', () => download);

const script: LectureScript = {
  language: 'vi',
  level: 'explore',
  scenes: [{ id: 'title', title: 'Giới thiệu', lines: [{ display: 'Xin chào.', spoken: 'Xin chào.' }], visual: { kind: 'title', projectName: 'Lá đậu', classNames: ['A'] } }],
};

function job() {
  return {
    projectName: 'Lá đậu',
    aspect: '16:9' as const,
    script,
    timeline: buildTimeline(script, '16:9', [[90]]),
    burnSubtitles: true,
    env: { t: i18n.getFixedT('vi'), language: 'vi', layout: frameLayout('16:9'), thumbs: new Map() },
    narration: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('ExportControls', () => {
  test('khóa nút khi chưa sẵn sàng (đang làm mờ ảnh / soi kỹ)', () => {
    render(<ExportControls job={job()} isReady={false} />);
    expect(screen.getByRole('button', { name: 'Xuất video' })).toBeDisabled();
  });

  test('xuất bằng WebCodecs: hiện tiến độ, tải tệp MP4 về và báo dung lượng', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(MP4_FORMAT);
    let finish!: () => void;
    exporter.exportWithWebCodecs.mockImplementation(async (request: ExportRequest) => {
      request.onProgress(0.42);
      await new Promise<void>((resolve) => (finish = resolve));
      return { blob: new Blob([new Uint8Array(2_500_000)], { type: 'video/mp4' }), format: MP4_FORMAT };
    });
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText('Đang dựng video: 40%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tiến độ dựng video' })).toHaveAttribute('value', '0.42');
    finish();
    expect(await screen.findByText(/Đã tạo .*-bai-giang-16x9\.mp4 \(2,5 MB\)\./)).toBeInTheDocument();
    expect(download.downloadBlob).toHaveBeenCalledWith(expect.stringMatching(/\.mp4$/), expect.any(Blob));
    expect(exporter.exportRealtime).not.toHaveBeenCalled();
  });

  test('bấm Hủy: dừng, không tải tệp nào', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(MP4_FORMAT);
    exporter.exportWithWebCodecs.mockImplementation(
      (request: ExportRequest) =>
        new Promise((_resolve, reject) => {
          request.onProgress(0.1);
          request.signal.addEventListener('abort', () => reject(new DOMException('hủy', 'AbortError')));
        }),
    );
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    await user.click(await screen.findByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Xuất video' })).toBeEnabled();
    expect(download.downloadBlob).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  test('không có WebCodecs: ghi theo thời gian thực, báo trước thời gian chờ', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(null);
    exporter.canRecordRealtime.mockReturnValue(true);
    exporter.exportRealtime.mockImplementation((request: ExportRequest) => {
      request.onProgress(0.5);
      return new Promise(() => undefined);
    });
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText(/^Trình duyệt này ghi video theo thời gian thực nên mất khoảng 2 phút\./)).toBeInTheDocument();
  });

  test('không mã hóa được cách nào: báo dùng trình duyệt khác', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(null);
    exporter.canRecordRealtime.mockReturnValue(false);
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText(/^Trình duyệt này không tạo được video\./)).toBeInTheDocument();
  });

  test('mã hóa nhanh hỏng giữa chừng: tự chuyển sang ghi theo thời gian thực', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(MP4_FORMAT);
    exporter.exportWithWebCodecs.mockRejectedValue(new Error('EncodingError'));
    exporter.canRecordRealtime.mockReturnValue(true);
    exporter.exportRealtime.mockResolvedValue({ blob: new Blob(['x'], { type: 'video/webm' }), format: { container: 'webm', codec: 'vp9', mime: 'video/webm' } });
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText(/Đã tạo .*\.webm/)).toBeInTheDocument();
    expect(exporter.exportRealtime).toHaveBeenCalledTimes(1);
  });

  test('bấm Hủy đúng lúc đang đóng gói (exporter vẫn trả kết quả): không tải tệp', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(MP4_FORMAT);
    let finish!: () => void;
    exporter.exportWithWebCodecs.mockImplementation(async (request: ExportRequest) => {
      request.onProgress(0.99);
      await new Promise<void>((resolve) => (finish = resolve));
      return { blob: new Blob(['x'], { type: 'video/mp4' }), format: MP4_FORMAT };
    });
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    await user.click(await screen.findByRole('button', { name: 'Hủy' }));
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xuất video' })).toBeEnabled());
    expect(download.downloadBlob).not.toHaveBeenCalled();
  });

  test('tab bị ẩn khi ghi thời gian thực: báo mở lại tab', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(null);
    exporter.canRecordRealtime.mockReturnValue(true);
    const hidden = new Error('ẩn');
    hidden.name = 'ExportHiddenError';
    exporter.exportRealtime.mockRejectedValue(hidden);
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText(/^Tab bị ẩn trong lúc ghi/)).toBeInTheDocument();
  });

  test('đổi lựa chọn sau khi xuất: ẩn thông báo của tệp cũ', async () => {
    const user = userEvent.setup();
    exporter.pickWebCodecsFormat.mockResolvedValue(MP4_FORMAT);
    exporter.exportWithWebCodecs.mockResolvedValue({ blob: new Blob(['x'], { type: 'video/mp4' }), format: MP4_FORMAT });
    const first = job();
    const { rerender } = render(<ExportControls job={first} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText(/Đã tạo/)).toBeInTheDocument();
    rerender(<ExportControls job={{ ...first, aspect: '9:16' }} isReady />);
    expect(screen.queryByText(/Đã tạo/)).not.toBeInTheDocument();
  });

  test('lỗi khi mã hóa: báo lỗi, nút bấm lại được', async () => {
    const user = userEvent.setup();
    exporter.canRecordRealtime.mockReturnValue(false);
    exporter.pickWebCodecsFormat.mockResolvedValue(MP4_FORMAT);
    exporter.exportWithWebCodecs.mockRejectedValue(new Error('hết bộ nhớ'));
    render(<ExportControls job={job()} isReady />);
    await user.click(screen.getByRole('button', { name: 'Xuất video' }));
    expect(await screen.findByText('Không xuất được video: hết bộ nhớ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất video' })).toBeEnabled();
  });
});
