import type { ReactNode } from 'react';
import { StepNumber } from '@/ui/StepNumber';
import { StepNotebook } from '@/features/notebook/StepNotebook';
import type { StepKey } from './StepBar';

interface StudioStepProps {
  readonly n: number;
  readonly id: string;
  readonly title: string;
  /** Bước đã xong (thanh các bước hiện dấu tích). Chỉ đặt khi trang biết chắc. */
  readonly done?: boolean;
  /** Bước này có ô Sổ tay (câu hỏi quan sát, giải thích và ghi chép) ở cuối. */
  readonly notebook?: StepKey;
  readonly children: ReactNode;
}

/** Một bước của Studio (đánh số 1…6), dùng chung cho Studio bảng, văn bản, âm thanh và tư thế. */
export function StudioStep({ n, id, title, done = false, notebook, children }: StudioStepProps) {
  return (
    <section aria-labelledby={id} data-step-done={done ? 'true' : undefined} className="space-y-4 border-t border-rule pt-6">
      <h2 id={id} className="flex items-center gap-3 font-display text-2xl font-bold">
        <StepNumber n={n} />
        {title}
      </h2>
      {children}
      {notebook && <StepNotebook step={notebook} />}
    </section>
  );
}
