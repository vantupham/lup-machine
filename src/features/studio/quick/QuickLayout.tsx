import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface QuickLayoutProps {
  /** Tiêu đề 3 cột: thu dữ liệu, cho máy học, xem thử. */
  readonly columns: readonly [data: string, train: string, preview: string];
  readonly lead: string;
  readonly children: readonly [data: ReactNode, train: ReactNode, preview: ReactNode];
}

/**
 * Khung "Dạy máy trong 3 bước" dùng chung cho các Studio: cả quy trình trên một màn hình
 * (thu dữ liệu → học → thử), dùng chung mô hình với các bước chi tiết bên dưới.
 */
export function QuickLayout({ columns, lead, children }: QuickLayoutProps) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="quick-title" className="space-y-4">
      <div>
        <h2 id="quick-title" className="font-display text-2xl font-bold">{t('project.quick.title')}</h2>
        <p className="max-w-3xl text-sm text-muted">{lead}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
        {columns.map((title, i) => (
          <div key={title} className="lab-card relative h-fit space-y-3 p-4">
            <h3 className="font-display text-lg font-bold">{title}</h3>
            {children[i]}
          </div>
        ))}
      </div>
    </section>
  );
}
