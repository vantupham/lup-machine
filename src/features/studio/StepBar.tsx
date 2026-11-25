import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const STEP_KEYS = ['data', 'check', 'represent', 'train', 'evaluate', 'use'] as const;
export type StepKey = (typeof STEP_KEYS)[number];

/** Id của tiêu đề mỗi bước trên trang. Phần bao quanh tiêu đề (<section>) mang `data-step-done`. */
export type StepTargets = Readonly<Record<StepKey, string>>;

/** Bốn Studio dùng StudioStep đặt id theo mẫu "<tiền tố>-step-<bước>". */
export function studioStepTargets(prefix: string): StepTargets {
  return Object.fromEntries(STEP_KEYS.map((key) => [key, `${prefix}-step-${key}`])) as Record<StepKey, string>;
}

interface StepState {
  readonly key: StepKey;
  readonly available: boolean;
  readonly done: boolean;
}

function readSteps(targets: StepTargets): StepState[] {
  return STEP_KEYS.map((key) => {
    const heading = document.getElementById(targets[key]);
    const section = heading?.closest('section');
    return { key, available: heading !== null, done: section?.dataset.stepDone === 'true' };
  });
}

const sameSteps = (a: readonly StepState[], b: readonly StepState[]) =>
  a.length === b.length && a.every((s, i) => s.available === b[i]?.available && s.done === b[i]?.done);

/** Theo dõi trang: bước nào đã hiện ra, bước nào đã xong (các phần tự gắn `data-step-done`). */
function useStepStates(targets: StepTargets): StepState[] {
  const [steps, setSteps] = useState<StepState[]>(() => STEP_KEYS.map((key) => ({ key, available: false, done: false })));
  useLayoutEffect(() => {
    const refresh = () => {
      const next = readSteps(targets);
      setSteps((prev) => (sameSteps(prev, next) ? prev : next));
    };
    refresh();
    // Biểu đồ huấn luyện đổi DOM liên tục: gom mọi thay đổi trong một khung hình thành một lần đọc.
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        refresh();
      });
    });
    observer.observe(document.getElementById('main') ?? document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-step-done'] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [targets]);
  return steps;
}

/** Khoảng chừa thêm dưới thanh bước khi cuộn tới một phần. */
const SCROLL_GAP_PX = 12;

/**
 * Thanh 6 bước dính ở đầu trang dự án: bấm để nhảy tới bước, thấy bước nào đã xong / chưa mở,
 * và nút "Bước tiếp" dẫn tới bước kế tiếp đã mở.
 */
export function StepBar({ targets }: { readonly targets: StepTargets }) {
  const { t } = useTranslation();
  const barRef = useRef<HTMLElement>(null);
  const steps = useStepStates(targets);
  const firstAvailable = steps.find((s) => s.available)?.key ?? 'data';
  const [chosen, setChosen] = useState<StepKey | null>(null);
  /** Bước vừa bấm: giữ nguyên đến khi phần của nó ra khỏi màn hình (trang ngắn cuộn chạm đáy không được cướp mất). */
  const pinned = useRef<StepKey | null>(null);
  /** Phần của bước được ghim đã hiện trên màn hình chưa (lúc đang cuộn tới thì chưa). */
  const pinnedReached = useRef(false);
  const active = chosen !== null && steps.some((s) => s.key === chosen && s.available) ? chosen : firstAvailable;

  /** Bước đang xem = bước cuối cùng có tiêu đề đã lên tới dưới thanh; cuộn hết trang thì là bước cuối đã mở. */
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const offset = (barRef.current?.offsetHeight ?? 0) + SCROLL_GAP_PX * 2;
        if (pinned.current) {
          const rect = document.getElementById(targets[pinned.current])?.closest('section')?.getBoundingClientRect();
          const visible = rect !== undefined && rect.top < window.innerHeight && rect.bottom > offset;
          if (visible) pinnedReached.current = true;
          if (rect !== undefined && (visible || !pinnedReached.current)) return;
          pinned.current = null;
        }
        const open = steps.filter((s) => s.available);
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        const passed = open.filter((s) => {
          const section = document.getElementById(targets[s.key])?.closest('section');
          return section ? section.getBoundingClientRect().top <= offset : false;
        });
        const next = atBottom ? open.at(-1) : passed.at(-1);
        setChosen(next?.key ?? null);
      });
    };
    const unpin = () => {
      pinned.current = null;
    };
    const intents = ['wheel', 'touchstart', 'keydown'] as const;
    window.addEventListener('scroll', onScroll, { passive: true });
    for (const name of intents) window.addEventListener(name, unpin, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      for (const name of intents) window.removeEventListener(name, unpin);
      cancelAnimationFrame(frame);
    };
  }, [steps, targets]);

  const goTo = useCallback(
    (key: StepKey) => {
      const heading = document.getElementById(targets[key]);
      if (!heading) return;
      const section = heading.closest('section') ?? heading;
      const barHeight = barRef.current?.offsetHeight ?? 0;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - barHeight - SCROLL_GAP_PX, behavior: reduceMotion ? 'auto' : 'smooth' });
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      pinned.current = key;
      pinnedReached.current = false;
      setChosen(key);
    },
    [targets],
  );

  const activeIndex = STEP_KEYS.indexOf(active);
  const next = steps.find((s, i) => i > activeIndex && s.available);

  return (
    <nav
      ref={barRef}
      data-step-bar
      aria-label={t('project.steps.label')}
      className="sticky top-0 z-30 -mx-4 border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur print:hidden"
    >
      <div className="flex items-center gap-3">
        <ol className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {steps.map((step, i) => {
            const isActive = step.key === active;
            const status = step.done ? t('project.stepBar.done') : step.available ? null : t('project.stepBar.locked');
            return (
              <li key={step.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => step.available && goTo(step.key)}
                  aria-disabled={!step.available}
                  aria-current={isActive ? 'step' : undefined}
                  title={step.available ? undefined : t('project.stepBar.lockedHint')}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-ink bg-ink text-paper'
                      : step.available
                        ? 'border-rule bg-surface hover:border-primary'
                        : 'cursor-not-allowed border-dashed border-rule text-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-5 items-center justify-center rounded-full font-mono text-[11px] ${step.done ? 'bg-accent text-white' : isActive ? 'bg-paper text-ink' : 'bg-rule/70'}`}
                  >
                    {step.done ? '✓' : i + 1}
                  </span>
                  <span className="sr-only">{t('project.stepBar.stepPrefix', { n: i + 1 })}:</span>{' '}
                  {t(`project.steps.${step.key}`)}
                  {status && (
                    <>
                      {' '}
                      <span className="sr-only">({status})</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        {next && (
          <button type="button" onClick={() => goTo(next.key)} className="btn btn-primary shrink-0 px-3 py-1 text-sm">
            {t('project.stepBar.next', { step: t(`project.steps.${next.key}`) })} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </nav>
  );
}
