import { useTranslation } from 'react-i18next';
import { X } from '@/ui/icons';

interface UndoToastProps {
  readonly message: string;
  readonly onUndo: () => void;
  readonly onDismiss: () => void;
}

/** Thông báo nhỏ ở cuối màn hình, kèm nút Hoàn tác. */
export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-md bg-ink px-4 py-3 text-sm text-paper shadow-lg print:hidden"
    >
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <button type="button" onClick={onUndo} className="rounded px-2 py-1 font-semibold text-highlight hover:bg-paper/10">
        {t('studio.undo')}
      </button>
      <button type="button" onClick={onDismiss} aria-label={t('studio.dismiss')} className="rounded p-1 hover:bg-paper/10">
        <X />
      </button>
    </div>
  );
}
