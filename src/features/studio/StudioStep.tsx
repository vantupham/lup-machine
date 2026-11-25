import type { ReactNode } from 'react';

interface StudioStepProps {
  readonly n: number;
  readonly id: string;
  readonly title: string;
  /** Bước đã xong (thanh các bước hiện dấu ✓). Chỉ đặt khi trang biết chắc. */
  readonly done?: boolean;
  readonly children: ReactNode;
}

/** Một bước của Studio (đánh số 01…06), dùng chung cho Studio bảng, văn bản, âm thanh và tư thế. */
export function StudioStep({ n, id, title, done = false, children }: StudioStepProps) {
  return (
    <section aria-labelledby={id} data-step-done={done ? 'true' : undefined} className="space-y-4 border-t border-rule pt-6">
      <h2 id={id} className="flex items-baseline gap-3 font-display text-2xl font-bold">
        <span className="font-mono text-sm text-primary">{String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
