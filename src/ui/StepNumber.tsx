import { Check } from './icons';

interface StepNumberProps {
  readonly n: number;
  readonly done?: boolean;
  readonly size?: 'sm' | 'md';
}

/** Số thứ tự của một bước, vẽ bằng CSS (không dùng ký tự số trong vòng tròn). Chỉ để nhìn: tiêu đề đã có tên bước. */
export function StepNumber({ n, done = false, size = 'md' }: StepNumberProps) {
  const box = size === 'sm' ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-sm';
  return (
    <span
      aria-hidden="true"
      data-step-number={n}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold ${box} ${
        done ? 'bg-accent text-paper' : 'bg-primary text-primary-ink'
      }`}
    >
      {done ? <Check className="h-[0.9em] w-[0.9em]" strokeWidth={3} /> : n}
    </span>
  );
}
