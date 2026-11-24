import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { createTestRepository, renderApp } from '../../tests/setup/render';
import { PRESENTATION_SCALES, usePresentationStore } from './presentation-store';

const root = document.documentElement;

describe('Chế độ trình chiếu', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    act(() => usePresentationStore.setState({ isOn: false, isLaserOn: false, scaleIndex: 1 }));
    window.localStorage.clear();
  });

  afterEach(() => {
    act(() => usePresentationStore.getState().exit());
  });

  test('bật: chữ to 125%, ẩn thanh điều hướng, hiện thanh điều khiển; Esc thoát và trả lại như cũ', async () => {
    const user = userEvent.setup();
    renderApp('/lessons', createTestRepository().repository);
    await user.click(screen.getByRole('button', { name: 'Trình chiếu' }));

    expect(root.dataset.presentation).toBe('on');
    expect(root.style.fontSize).toBe('125%');
    expect(screen.getByRole('group', { name: 'Điều khiển trình chiếu' })).toBeInTheDocument();
    expect(screen.getByTestId('presentation-scale')).toHaveTextContent('125%');
    // thanh điều hướng bị ẩn nên con trỏ bàn phím được đưa tới nút Thoát
    expect(screen.getByRole('button', { name: 'Thoát (Esc)' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(root.dataset.presentation).toBeUndefined();
    expect(root.style.fontSize).toBe('');
    expect(screen.queryByRole('group', { name: 'Điều khiển trình chiếu' })).toBeNull();
  });

  test('phím + / − đổi cỡ chữ trong giới hạn và được nhớ cho lần sau', async () => {
    const user = userEvent.setup();
    renderApp('/lessons', createTestRepository().repository);
    await user.click(screen.getByRole('button', { name: 'Trình chiếu' }));
    await user.keyboard('+++');
    expect(root.style.fontSize).toBe(`${PRESENTATION_SCALES.at(-1)! * 100}%`);
    expect(window.localStorage.getItem('lup.presentationScale')).toBe(String(PRESENTATION_SCALES.length - 1));
    await user.click(screen.getByRole('button', { name: 'Chữ nhỏ hơn (phím −)' }));
    await user.keyboard('----');
    expect(root.style.fontSize).toBe(`${PRESENTATION_SCALES[0] * 100}%`);
  });

  test('phím L bật con trỏ laser, chấm đỏ đi theo chuột, ẩn con trỏ chuột', async () => {
    const user = userEvent.setup();
    renderApp('/lessons', createTestRepository().repository);
    await user.click(screen.getByRole('button', { name: 'Trình chiếu' }));
    await user.keyboard('l');
    expect(screen.getByRole('button', { name: 'Laser (L)' })).toHaveAttribute('aria-pressed', 'true');
    // con trỏ chuột chỉ bị ẩn khi chấm laser đã xuất hiện
    expect(root.dataset.laser).toBeUndefined();
    fireEvent.pointerMove(window, { clientX: 120, clientY: 80 });
    expect(root.dataset.laser).toBe('on');
    expect(screen.getByTestId('laser-pointer').style.transform).toBe('translate(120px, 80px)');
    await user.keyboard('L');
    expect(screen.queryByTestId('laser-pointer')).toBeNull();
    expect(root.dataset.laser).toBeUndefined();
  });

  test('đang gõ chữ trong ô nhập thì phím tắt không chạy', async () => {
    const user = userEvent.setup();
    const r = createTestRepository();
    renderApp('/studio', r.repository);
    await user.click(screen.getByRole('button', { name: 'Trình chiếu' }));
    await user.type(screen.getByLabelText('Tên dự án'), 'Lớp 7+L');
    expect(screen.getByLabelText('Tên dự án')).toHaveValue('Lớp 7+L');
    expect(root.style.fontSize).toBe('125%');
    expect(screen.queryByTestId('laser-pointer')).toBeNull();
  });

  test('ngoài chế độ trình chiếu, phím tắt không làm gì; laser chỉ bật được khi đang trình chiếu', async () => {
    const user = userEvent.setup();
    renderApp('/lessons', createTestRepository().repository);
    await user.keyboard('l+');
    expect(root.dataset.presentation).toBeUndefined();
    act(() => usePresentationStore.getState().toggleLaser());
    expect(usePresentationStore.getState().isLaserOn).toBe(false);
  });

  test('giữ phím (lặp) hoặc bộ gõ đang ghép chữ thì không chạy phím tắt', async () => {
    const user = userEvent.setup();
    renderApp('/lessons', createTestRepository().repository);
    await user.click(screen.getByRole('button', { name: 'Trình chiếu' }));
    fireEvent.keyDown(window, { key: '+', repeat: true });
    fireEvent.keyDown(window, { key: 'l', isComposing: true });
    expect(root.style.fontSize).toBe('125%');
    expect(screen.queryByTestId('laser-pointer')).toBeNull();
  });

  test('toàn màn hình: phím F gọi trình duyệt; trình duyệt chặn thì vẫn trình chiếu bình thường', async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockRejectedValue(new Error('chặn'));
    Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: request });
    renderApp('/lessons', createTestRepository().repository);
    await user.click(screen.getByRole('button', { name: 'Trình chiếu' }));
    await user.keyboard('f');
    expect(request).toHaveBeenCalled();
    expect(root.dataset.presentation).toBe('on');
  });
});
