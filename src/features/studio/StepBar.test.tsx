import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import i18n from '@/i18n';
import { StepBar, studioStepTargets } from './StepBar';
import { StudioStep } from './StudioStep';

/** Trang giả: bước 1–3 có sẵn, bước 4 hiện ra khi bấm nút, bước 5–6 chưa có. */
function Harness() {
  const [showTrain, setShowTrain] = useState(false);
  const [trained, setTrained] = useState(false);
  return (
    <main id="main">
      <StepBar targets={studioStepTargets('demo')} />
      <StudioStep n={1} id="demo-step-data" title="Dữ liệu" done>
        <button type="button" onClick={() => setShowTrain(true)}>Mở bước huấn luyện</button>
      </StudioStep>
      <StudioStep n={2} id="demo-step-check" title="Kiểm tra">…</StudioStep>
      <StudioStep n={3} id="demo-step-represent" title="Biểu diễn">…</StudioStep>
      {showTrain && (
        <StudioStep n={4} id="demo-step-train" title="Huấn luyện" done={trained}>
          <button type="button" onClick={() => setTrained(true)}>Huấn luyện xong</button>
        </StudioStep>
      )}
    </main>
  );
}

describe('thanh các bước của dự án', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    window.scrollTo = vi.fn();
  });

  const bar = () => screen.getByRole('navigation', { name: 'Các bước của dự án' });
  const step = (n: number) => within(bar()).getByRole('button', { name: new RegExp(`^Bước ${n}:`) });

  test('đủ 6 bước; bước chưa hiện trên trang thì "chưa mở"', () => {
    render(<Harness />);
    expect(within(bar()).getAllByRole('listitem')).toHaveLength(6);
    expect(step(1)).toHaveAccessibleName('Bước 1: Dữ liệu (đã xong)');
    expect(step(2)).toHaveAccessibleName('Bước 2: Kiểm tra dữ liệu');
    expect(step(2)).toHaveAttribute('aria-disabled', 'false');
    expect(step(4)).toHaveAccessibleName('Bước 4: Huấn luyện (chưa mở)');
    expect(step(4)).toHaveAttribute('aria-disabled', 'true');
  });

  test('bước vừa hiện ra và vừa xong được cập nhật ngay', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở bước huấn luyện' }));
    expect(await within(bar()).findByRole('button', { name: 'Bước 4: Huấn luyện' })).toHaveAttribute('aria-disabled', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Huấn luyện xong' }));
    expect(await within(bar()).findByRole('button', { name: 'Bước 4: Huấn luyện (đã xong)' })).toBeInTheDocument();
  });

  test('bấm một bước: cuộn tới và đưa con trỏ vào tiêu đề bước đó', async () => {
    render(<Harness />);
    await userEvent.click(step(3));
    expect(window.scrollTo).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Biểu diễn/ })).toHaveFocus();
    expect(step(3)).toHaveAttribute('aria-current', 'step');
  });

  test('bấm bước chưa mở thì không làm gì', async () => {
    render(<Harness />);
    await userEvent.click(step(5));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  test('"Bước tiếp" đi tới bước đã mở kế tiếp, hết bước mở thì ẩn', async () => {
    render(<Harness />);
    await userEvent.click(within(bar()).getByRole('button', { name: 'Bước tiếp: Kiểm tra dữ liệu' }));
    expect(screen.getByRole('heading', { name: /Kiểm tra/ })).toHaveFocus();
    await userEvent.click(within(bar()).getByRole('button', { name: 'Bước tiếp: Biểu diễn' }));
    expect(within(bar()).queryByRole('button', { name: /^Bước tiếp/ })).toBeNull();
  });

  test('cuộn trang: bước đang xem là bước cuối đã lên tới dưới thanh; cuộn hết trang là bước cuối đã mở', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    render(<Harness />);
    const tops: Record<string, number> = { 'demo-step-data': -600, 'demo-step-check': -40, 'demo-step-represent': 500 };
    for (const [id, top] of Object.entries(tops)) {
      const section = document.getElementById(id)!.closest('section')!;
      vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
    }
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
    fireEvent.scroll(window);
    await waitFor(() => expect(step(2)).toHaveAttribute('aria-current', 'step'));
    expect(within(bar()).getByRole('button', { name: 'Bước tiếp: Biểu diễn' })).toBeInTheDocument();

    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 });
    fireEvent.scroll(window);
    await waitFor(() => expect(step(3)).toHaveAttribute('aria-current', 'step'));
    vi.restoreAllMocks();
  });

  test('bấm một bước gần cuối trang: cuộn chạm đáy vẫn giữ đúng bước vừa bấm', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    render(<Harness />);
    const represent = document.getElementById('demo-step-represent')!.closest('section')!;
    await userEvent.click(step(2));
    const check = document.getElementById('demo-step-check')!.closest('section')!;
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 });
    // Đang cuộn tới: phần còn ở dưới màn hình, chưa được bỏ ghim.
    vi.spyOn(represent, 'getBoundingClientRect').mockReturnValue({ top: 3000, bottom: 3400 } as DOMRect);
    vi.spyOn(check, 'getBoundingClientRect').mockReturnValue({ top: 2000, bottom: 2300 } as DOMRect);
    fireEvent.scroll(window);
    expect(step(2)).toHaveAttribute('aria-current', 'step');
    // Đã tới và chạm đáy trang: vẫn là bước vừa bấm.
    vi.spyOn(represent, 'getBoundingClientRect').mockReturnValue({ top: 300, bottom: 700 } as DOMRect);
    vi.spyOn(check, 'getBoundingClientRect').mockReturnValue({ top: 60, bottom: 280 } as DOMRect);
    fireEvent.scroll(window);
    expect(step(2)).toHaveAttribute('aria-current', 'step');

    vi.spyOn(check, 'getBoundingClientRect').mockReturnValue({ top: -900, bottom: -700 } as DOMRect);
    fireEvent.scroll(window);
    await waitFor(() => expect(step(3)).toHaveAttribute('aria-current', 'step'));
    vi.restoreAllMocks();
  });

  test('đã bấm một bước rồi tự lăn chuột đi chỗ khác thì thanh theo vị trí cuộn trở lại', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    render(<Harness />);
    await userEvent.click(step(3));
    const tops: Record<string, number> = { 'demo-step-data': -600, 'demo-step-check': 10, 'demo-step-represent': 2000 };
    for (const [id, top] of Object.entries(tops)) {
      vi.spyOn(document.getElementById(id)!.closest('section')!, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + 300 } as DOMRect);
    }
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
    fireEvent.wheel(window);
    fireEvent.scroll(window);
    await waitFor(() => expect(step(2)).toHaveAttribute('aria-current', 'step'));
    vi.restoreAllMocks();
  });
});
