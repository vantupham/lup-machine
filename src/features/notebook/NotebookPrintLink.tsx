import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Printer } from '@/ui/icons';

/** Liên kết tới trang in Sổ tay thí nghiệm của dự án (đặt cạnh liên kết Thẻ mô hình). */
export function NotebookPrintLink({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation();
  return (
    <Link to={`/studio/${projectId}/so-tay`} className="inline-flex items-center gap-2 rounded-full border border-rule px-3 py-1 text-sm hover:bg-surface">
      <Printer /> {t('inquiry.print.link')}
    </Link>
  );
}
