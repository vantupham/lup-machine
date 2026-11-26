import { ensureStepVisible } from '@/features/studio/step-details';

/** Cuộn tới tiêu đề một phần bên dưới (chừa chỗ cho thanh các bước) và đưa con trỏ vào đó. */
export function revealHeading(id: string): void {
  const heading = document.getElementById(id);
  if (!heading) return;
  ensureStepVisible(heading);
  const section = heading.closest('section') ?? heading;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const stickyBar = document.querySelector<HTMLElement>('nav[data-step-bar]')?.offsetHeight ?? 0;
  window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - stickyBar - 12, behavior: reduceMotion ? 'auto' : 'smooth' });
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
}
