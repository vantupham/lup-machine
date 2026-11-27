import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_HASH_CONTRAST, NEAR_DUPLICATE_MAX_BITS, type DuplicatePair } from '@/core/data/deep-checks';
import { DATA_CHECK_PROGRAM, traceDataCheck } from '@/core/trace/data-check-trace';
import { HELPERS_PROGRAM } from '@/core/trace/helpers-program';
import { CodeTracePanel } from '@/features/code-trace/CodeTracePanel';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ExactBadge } from '@/ui/ExactBadge';
import { useModeStore } from '@/ui/mode-store';
import { Check, CornerDownRight } from '@/ui/icons';
import { BrightnessChart, PairRow } from './DeepCheckVisuals';
import { useDeepChecks } from './useDeepChecks';

/** Số cặp ảnh hiện ra ở mỗi nhóm (còn lại chỉ báo số lượng). */
const SHOWN_PAIRS = 3;

interface DeepCheckPanelProps {
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
}

/** Bước 2, phần "Soi kỹ từng ảnh": ảnh gần trùng, ảnh lộ đề, lối tắt nền, kèm mã Python chạy với số đo thật. */
export function DeepCheckPanel({ classes, samples }: DeepCheckPanelProps) {
  const { t } = useTranslation();
  const check = useDeepChecks(classes, samples);
  const { status } = check;
  const isRunning = status.phase === 'running';
  const isComplete = check.hasMeasured && check.missingCount === 0;
  const { images, size } = check;
  const createTrace = useMemo(
    () =>
      isComplete && images.length > 0
        ? () => traceDataCheck({ images, classNames: classes.map((c) => c.name), size, maxBits: NEAR_DUPLICATE_MAX_BITS, minContrast: MIN_HASH_CONTRAST })
        : null,
    [isComplete, images, classes, size],
  );

  return (
    <section aria-labelledby="deep-check-title" className="space-y-4" data-testid="deep-check">
      <div>
        <h3 id="deep-check-title" className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {t('project.deepCheck.title')}
          <ExactBadge label={t('playground.exact')} hint={t('project.deepCheck.exactHint')} />
        </h3>
        <p className="max-w-3xl text-sm text-muted">{t('project.deepCheck.lead')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {check.missingCount > 0 ? (
          <button type="button" className="btn btn-primary" disabled={isRunning} onClick={() => void check.run()}>
            {t(check.hasMeasured ? 'project.deepCheck.rerun' : 'project.deepCheck.run', { count: check.missingCount })}
          </button>
        ) : (
          check.hasMeasured && <p className="text-sm text-accent"><Check /> {t('project.deepCheck.allDone', { count: images.length })}</p>
        )}
        {isRunning && <p role="status" className="text-sm">{t('project.deepCheck.running', status)}</p>}
        {status.phase === 'error' && <p role="alert" className="text-sm text-danger">{t('project.deepCheck.error', { message: status.message })}</p>}
      </div>
      {check.hasMeasured && (
        <div className="grid gap-6 lg:grid-cols-2">
          <BrightnessChart classes={classes} images={images} />
          <Findings classes={classes} check={check} />
        </div>
      )}
      <CodeTracePanel
        program={DATA_CHECK_PROGRAM}
        helpers={HELPERS_PROGRAM}
        create={createTrace}
        emptyHint={t('project.deepCheck.codeEmpty')}
        jumpLabel={t('codeTrace.toNextPrint')}
      />
    </section>
  );
}

function Findings({ classes, check }: { readonly classes: readonly ClassRecord[]; readonly check: ReturnType<typeof useDeepChecks> }) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const shortcuts = check.backgrounds.filter((b) => b.isShortcut);
  const leaks = check.duplicates.filter((p) => p.isLeak);
  const same = check.duplicates.filter((p) => !p.isLeak);
  const name = (i: number) => classes[i]?.name ?? '';
  const tip = (key: string) =>
    mode === 'explore' ? <p className="mt-0.5 text-xs text-muted"><CornerDownRight className="mr-1" />{t(key)}</p> : null;

  const flatNote = check.flatCount > 0 && <p className="text-xs text-muted">{t('project.deepCheck.flat', { count: check.flatCount })}</p>;
  if (shortcuts.length === 0 && check.duplicates.length === 0) {
    return (
      <div className="space-y-2">
        <p role="status" className="h-fit rounded bg-accent/10 p-3 text-sm text-accent"><Check /> {t('project.deepCheck.ok')}</p>
        {flatNote}
      </div>
    );
  }
  return (
    <div className="space-y-2">
    <ul className="space-y-3" aria-label={t('project.deepCheck.findings')}>
      {shortcuts.map((s) => (
        <Finding key={`bg-${s.a}-${s.b}`} severity="warning" tip={tip('project.deepCheck.shortcutTip')}>
          {t('project.deepCheck.shortcut', { a: name(s.a), b: name(s.b), percent: Math.round(s.accuracy * 100), bright: name(s.brighter) })}
        </Finding>
      ))}
      {leaks.length > 0 && (
        <Finding severity="warning" tip={tip('project.deepCheck.leakTip')}>
          {t('project.deepCheck.leakTitle', { count: leaks.length })}
          <Pairs pairs={leaks} check={check} />
        </Finding>
      )}
      {same.length > 0 && (
        <Finding severity="info" tip={tip('project.deepCheck.sameTip')}>
          {t('project.deepCheck.sameTitle', { count: same.length })}
          <Pairs pairs={same} check={check} />
        </Finding>
      )}
    </ul>
    {flatNote}
    </div>
  );
}

function Finding({ severity, tip, children }: { readonly severity: 'warning' | 'info'; readonly tip: ReactNode; readonly children: ReactNode }) {
  return (
    <li className={`border-l-4 py-1 pl-3 text-sm ${severity === 'warning' ? 'border-warning' : 'border-rule'}`}>
      {children}
      {tip}
    </li>
  );
}

function Pairs({ pairs, check }: { readonly pairs: readonly DuplicatePair[]; readonly check: ReturnType<typeof useDeepChecks> }) {
  const { t } = useTranslation();
  return (
    <>
      <ul className="mt-2 space-y-2">
        {pairs.slice(0, SHOWN_PAIRS).map((p) => (
          <PairRow key={`${p.a}-${p.b}`} pair={p} samples={check.samples} images={check.images} />
        ))}
      </ul>
      {pairs.length > SHOWN_PAIRS && <p className="mt-1 text-xs text-muted">{t('project.deepCheck.more', { count: pairs.length - SHOWN_PAIRS })}</p>}
      <p className="mt-1 text-xs text-muted">{t('project.deepCheck.fingerprintNote')}</p>
    </>
  );
}
