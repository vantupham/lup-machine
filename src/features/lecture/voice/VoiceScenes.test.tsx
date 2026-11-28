import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/i18n';
import type { LectureScript } from '../lecture-script';
import type { SceneVoice } from './useLectureVoices';
import { VoiceScenes } from './VoiceScenes';
import type { RecorderState } from './useVoiceRecorder';

const script: LectureScript = {
  language: 'vi',
  level: 'explore',
  scenes: [
    { id: 'title', title: 'Giới thiệu', lines: [{ display: 'Xin chào các em.', spoken: 'Xin chào các em.' }], visual: { kind: 'title', projectName: 'Lá đậu', classNames: ['A'] } },
    { id: 'summary', title: 'Tóm lại', lines: [{ display: 'Hết bài.', spoken: 'Hết bài.' }], visual: { kind: 'summary', testAccuracy: 0.5 } },
  ],
};

function voice(sceneId: string, text: string, duration = 4.5): SceneVoice {
  return {
    voice: { projectId: 'p', level: 'explore', sceneId, audio: new ArrayBuffer(8), mime: 'audio/webm', duration, text, createdAt: '' },
    buffer: { duration } as AudioBuffer,
  };
}

function renderScenes(recorder: RecorderState, voices = new Map<string, SceneVoice>()) {
  const handlers = { onRecord: vi.fn(), onStop: vi.fn(), onRemove: vi.fn() };
  render(<VoiceScenes script={script} voices={voices} recorder={recorder} {...handlers} />);
  return handlers;
}

describe('VoiceScenes', () => {
  test('mỗi cảnh có nút thu giọng; đếm số cảnh đã thu', async () => {
    const user = userEvent.setup();
    const handlers = renderScenes({ phase: 'idle' });
    expect(screen.getByText(/Đã thu 0\/2 cảnh\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Thu giọng cảnh Tóm lại' }));
    expect(handlers.onRecord).toHaveBeenCalledWith(script.scenes[1]);
  });

  test('đang thu: nút Dừng đếm giây, các cảnh khác tạm khóa', async () => {
    const user = userEvent.setup();
    const handlers = renderScenes({ phase: 'recording', sceneId: 'title', elapsed: 3.7 });
    await user.click(screen.getByRole('button', { name: 'Dừng (3 giây)' }));
    expect(handlers.onStop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Thu giọng cảnh Tóm lại' })).toBeDisabled();
  });

  test('đã thu: hiện thời lượng, nghe lại, xóa; lời đổi sau khi thu thì nhắc thu lại', async () => {
    const user = userEvent.setup();
    const voices = new Map([
      ['title', voice('title', 'Xin chào các em.')],
      ['summary', voice('summary', 'Lời cũ.', 2)],
    ]);
    const handlers = renderScenes({ phase: 'idle' }, voices);
    expect(screen.getByText(/Đã thu 2\/2 cảnh\./)).toBeInTheDocument();
    const title = screen.getByRole('heading', { name: 'Giới thiệu' }).closest('li')!;
    expect(within(title).getByText('Đã thu 4,5 giây')).toBeInTheDocument();
    expect(within(title).getByLabelText('Nghe lại cảnh Giới thiệu')).toBeInTheDocument();
    expect(within(title).queryByText(/Lời đã đổi/)).not.toBeInTheDocument();
    const summary = screen.getByRole('heading', { name: 'Tóm lại' }).closest('li')!;
    expect(within(summary).getByText(/Lời đã đổi sau khi thu/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xóa bản thu cảnh Giới thiệu' }));
    expect(handlers.onRemove).toHaveBeenCalledWith(script.scenes[0]);
  });

  test('micro bị chặn: báo cho phép micro', () => {
    renderScenes({ phase: 'error', sceneId: 'title', kind: 'denied', message: 'NotAllowedError' });
    expect(screen.getByRole('alert')).toHaveTextContent('Không dùng được micro.');
  });
});
