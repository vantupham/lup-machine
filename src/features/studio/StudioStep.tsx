import type { ReactNode } from 'react';

/** Một bước của Studio (đánh số 01…06), dùng chung cho Studio bảng và Studio văn bản. */
export function StudioStep({ n, id, title, children }: { readonly n: number; readonly id: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 border-t border-rule pt-6">
      <h2 id={id} className="flex items-baseline gap-3 font-display text-2xl font-bold">
        <span className="font-mono text-sm text-primary">{String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
