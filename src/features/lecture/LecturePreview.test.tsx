import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import { LecturePreview } from './LecturePreview';
import type { LectureScript } from './lecture-script';
import { buildTimeline } from './script-timeline';

const script: LectureScript = {
  language: 'vi',
  level: 'explore',
  scenes: [
    { id: 'title', title: 'Giới thiệu', lines: [{ display: 'Xin chào các em.', spoken: 'Xin chào các em.' }], visual: { kind: 'title', projectName: 'Lá đậu', classNames: ['A'] } },
    { id: 'summary', title: 'Tóm lại', lines: [{ display: 'Hết bài.', spoken: 'Hết bài.' }], visual: { kind: 'summary', score: { split: 'test', accuracy: 0.5 }, confusion: null } },
  ],
};
const timeline = buildTimeline(script, '16:9', [[3], [2]]);

function renderPreview(aspect: '16:9' | '9:16' = '16:9') {
  return render(<LecturePreview script={script} timeline={timeline} aspect={aspect} burnSubtitles thumbs={new Map()} thumbsPhase="ready" />);
}

describe('LecturePreview', () => {
  test('khung hình đúng khổ, nhãn nêu cảnh đang xem', () => {
    renderPreview('9:16');
    const canvas = screen.getByRole('img', { name: 'Xem trước video bài giảng, cảnh Giới thiệu' });
    expect(canvas).toHaveAttribute('width', '720');
    expect(canvas).toHaveAttribute('height', '1280');
  });

  test('kéo thanh vị trí: đổi cảnh và đồng hồ', () => {
    renderPreview();
    expect(screen.getByText('0:00 / 0:05')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Vị trí trong video' }), { target: { value: '4.5' } });
    expect(screen.getByRole('img', { name: 'Xem trước video bài giảng, cảnh Tóm lại' })).toBeInTheDocument();
    expect(screen.getByText('0:04 / 0:05')).toBeInTheDocument();
  });

  test('nút Phát / Dừng; ở cuối video bấm Phát thì chạy lại từ đầu', async () => {
    const user = userEvent.setup();
    renderPreview();
    await user.click(screen.getByRole('button', { name: 'Phát' }));
    await user.click(screen.getByRole('button', { name: 'Dừng' }));
    expect(screen.getByRole('button', { name: 'Phát' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Vị trí trong video' }), { target: { value: String(timeline.duration) } });
    await user.click(screen.getByRole('button', { name: 'Phát' }));
    expect(screen.getByRole('button', { name: 'Dừng' })).toBeInTheDocument();
    expect(screen.getByText(/^0:0[01] \/ 0:05$/)).toBeInTheDocument();
  });
});
