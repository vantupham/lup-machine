import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Hộp thoại phủ màn hình: đóng bằng Esc, giữ focus trong hộp thoại, trả focus khi đóng. */
export function Dialog({ title, subtitle, closeLabel, onClose, children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="lab-card my-8 w-full max-w-4xl p-5 outline-none"
      >
        <header className="mb-4 flex items-start gap-4">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-bold">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost ml-auto px-3 py-1 text-sm">
            {closeLabel}
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
