import { useTranslation } from 'react-i18next';
import type { AutosaveState } from './useAutosave';

/** Dòng trạng thái dưới ô tự lưu: "Đang lưu…", "Đã lưu" hoặc lỗi. */
export function AutosaveStatus({ state }: { readonly state: AutosaveState }) {
  const { t } = useTranslation();
  if (state.kind === 'error') {
    return <p role="alert" className="text-xs text-danger">{t('autosave.error', { message: state.message })}</p>;
  }
  return (
    <p role="status" className="text-xs text-muted">
      {state.kind === 'saving' ? t('autosave.saving') : state.kind === 'saved' ? t('autosave.saved') : ''}
    </p>
  );
}
