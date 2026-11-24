import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { presentationScale, usePresentationStore } from './presentation-store';

/** Nút trên thanh đầu trang để vào chế độ trình chiếu. */
export function PresentationToggle() {
  const { t } = useTranslation();
  const enter = usePresentationStore((s) => s.enter);
  return (
    <button type="button" onClick={enter} title={t('presentation.enterHint')} className="btn btn-ghost px-3 py-1.5 text-sm">
      {t('presentation.enter')}
    </button>
  );
}

/** Phím tắt không chạy khi đang gõ chữ (ô nhập, ô soạn thảo, ô chọn). */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Bỏ qua có chủ đích: trình duyệt có thể chặn toàn màn hình (ví dụ khi nhúng trong khung);
    // trình chiếu vẫn dùng bình thường, chỉ không phủ kín màn hình.
  }
}

/** Gắn một lần trong khung trang: áp dụng cỡ chữ, phím tắt, thanh điều khiển và con trỏ laser. */
export function PresentationController() {
  const { t } = useTranslation();
  const { isOn, isLaserOn, scaleIndex, exit, toggleLaser, bigger, smaller } = usePresentationStore();
  const scale = presentationScale(scaleIndex);
  const exitButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!isOn) return undefined;
    const previousFontSize = root.style.fontSize;
    root.dataset.presentation = 'on';
    root.style.fontSize = `${scale * 100}%`;
    return () => {
      delete root.dataset.presentation;
      root.style.fontSize = previousFontSize;
    };
  }, [isOn, scale]);

  // Thanh điều hướng bị ẩn khi trình chiếu: đưa con trỏ bàn phím tới nút Thoát, thoát thì trả về chỗ cũ.
  useEffect(() => {
    if (!isOn) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    exitButton.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [isOn]);

  useEffect(() => {
    if (!isOn) return undefined;
    const onKey = (event: KeyboardEvent) => {
      // Bỏ qua khi: có phím bổ trợ, đang gõ chữ, bộ gõ tiếng Việt đang ghép chữ, hoặc giữ phím (lặp).
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat || isTyping(event.target)) return;
      const actions: Record<string, () => void> = {
        Escape: () => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          exit();
        },
        l: toggleLaser,
        L: toggleLaser,
        f: () => void toggleFullscreen(),
        F: () => void toggleFullscreen(),
        '+': bigger,
        '=': bigger,
        '-': smaller,
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOn, exit, toggleLaser, bigger, smaller]);

  if (!isOn) return null;
  return (
    <>
      <div role="group" aria-label={t('presentation.bar')} data-presentation-bar className="fixed right-3 top-3 z-50 flex items-center gap-1 rounded-full border border-rule bg-surface/95 p-1 text-sm shadow-lg print:hidden">
        <button type="button" onClick={smaller} aria-label={t('presentation.smaller')} className="btn btn-ghost px-2 py-1">A−</button>
        <span className="px-1 font-mono text-xs" data-testid="presentation-scale">{t('presentation.size', { percent: Math.round(scale * 100) })}</span>
        <button type="button" onClick={bigger} aria-label={t('presentation.bigger')} className="btn btn-ghost px-2 py-1">A+</button>
        <button type="button" onClick={toggleLaser} aria-pressed={isLaserOn} className={`btn px-3 py-1 ${isLaserOn ? 'btn-primary' : 'btn-ghost'}`}>
          {t('presentation.laser')}
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} className="btn btn-ghost px-3 py-1">{t('presentation.fullscreen')}</button>
        <button ref={exitButton} type="button" onClick={exit} className="btn btn-ghost px-3 py-1">{t('presentation.exit')}</button>
      </div>
      {isLaserOn && <LaserPointer />}
    </>
  );
}

/** Chấm đỏ phát sáng đi theo chuột; di chuyển bằng transform (không vẽ lại React mỗi lần chuột động). */
function LaserPointer() {
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const onMove = (event: PointerEvent) => {
      const el = dot.current;
      if (!el) return;
      // Chỉ ẩn con trỏ chuột khi chấm laser đã hiện (trước đó vẫn thấy con trỏ thường).
      root.dataset.laser = 'on';
      el.style.opacity = '1';
      el.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      delete root.dataset.laser;
    };
  }, []);

  return <div ref={dot} aria-hidden="true" data-testid="laser-pointer" className="laser-pointer" />;
}
