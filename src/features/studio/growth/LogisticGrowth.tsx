import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fitLogisticHistory, predictLogisticProba, type LogisticIterate } from '@/core/algorithms/logistic-regression';
import { ExactBadge } from '@/ui/ExactBadge';
import { LineChart } from '@/features/studio/image/lab/LineChart';
import { POSITIVE, NEGATIVE } from '@/features/studio/image/lab/step-visuals';

/** Số đặc trưng nặng ký nhất hiện cho mỗi lớp. */
const TOP_FEATURES = 6;

export interface LogisticGrowthProps {
  /** Đúng dữ liệu (đã mã hóa) và C mà mô hình vừa huấn luyện dùng. */
  readonly xs: readonly (readonly number[])[];
  readonly ys: readonly number[];
  readonly numClasses: number;
  readonly c: number;
  readonly classNames: readonly string[];
  readonly featureNames: readonly string[];
}

/** Bước 4 (hồi quy logistic): phát lại từng vòng lặp L-BFGS. Chỉ tính khi mở mục này (huấn luyện lại một lần). */
export function LogisticGrowth(props: LogisticGrowthProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <details className="rounded border border-rule p-3 text-sm" onToggle={(e) => setIsOpen(e.currentTarget.open)} data-testid="logistic-growth">
      <summary className="cursor-pointer font-semibold">{t('growth.logistic.title')}</summary>
      {isOpen && <LogisticHistory {...props} />}
    </details>
  );
}

function accuracyOf(history: readonly LogisticIterate[], xs: LogisticGrowthProps['xs'], ys: readonly number[]): number[] {
  return history.map((h) => {
    let correct = 0;
    xs.forEach((x, n) => {
      const p = predictLogisticProba(h.model, x);
      if (p.indexOf(Math.max(...p)) === ys[n]) correct++;
    });
    return correct / xs.length;
  });
}

function LogisticHistory({ xs, ys, numClasses, c, classNames, featureNames }: LogisticGrowthProps) {
  const { t, i18n } = useTranslation();
  const { history } = useMemo(() => fitLogisticHistory(xs, ys, numClasses, { c }), [xs, ys, numClasses, c]);
  const accuracy = useMemo(() => accuracyOf(history, xs, ys), [history, xs, ys]);
  const [at, setAt] = useState(history.length - 1);
  const shown = Math.min(at, history.length - 1);
  const it = history[shown]!;
  const last = history.length - 1;
  const fmt = (v: number, d = 3) => v.toLocaleString(i18n.language, { maximumFractionDigits: d });
  /** 2 lớp: một hàng trọng số "nghiêng về lớp thứ 2"; từ 3 lớp: mỗi lớp một hàng. */
  const rowNames = numClasses === 2 ? [t('growth.logistic.towards', { cls: classNames[1] })] : classNames;

  return (
    <div className="mt-3 space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-muted">
        {t('growth.logistic.lead', { count: last })}
        <ExactBadge label={t('playground.exact')} hint={t('growth.logistic.exactHint')} />
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <LineChart title={t('growth.logistic.objective')} series={[{ label: t('growth.logistic.objectiveSeries'), color: POSITIVE, values: history.map((h) => h.objective) }]} maxX={last} markerX={shown} xAxisLabel={t('growth.logistic.axis', { n: last })} />
        <LineChart title={t('growth.logistic.accuracy')} series={[{ label: '%', color: NEGATIVE, values: accuracy.map((a) => a * 100) }]} maxX={last} yMax={100} markerX={shown} xAxisLabel={t('growth.logistic.axis', { n: last })} />
      </div>
      <label className="block">
        <span className="font-medium">{t('growth.logistic.slider', { n: shown, max: last })}</span>
        <input type="range" min={0} max={last} value={shown} onChange={(e) => setAt(Number(e.target.value))} className="mt-1 block w-full" />
      </label>
      <p data-testid="logistic-iterate">{t('growth.logistic.status', { n: shown, objective: fmt(it.objective), accuracy: fmt(accuracy[shown]! * 100, 1) })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {it.model.weights.map((row, k) => (
          <FeatureBars key={k} title={rowNames[k] ?? ''} weights={row} featureNames={featureNames} />
        ))}
      </div>
      <p className="text-xs text-muted">{t('growth.logistic.note')}</p>
    </div>
  );
}

function FeatureBars({ title, weights, featureNames }: { readonly title: string; readonly weights: readonly number[]; readonly featureNames: readonly string[] }) {
  const { i18n } = useTranslation();
  const top = weights
    .map((w, j) => ({ w, j }))
    .sort((a, b) => Math.abs(b.w) - Math.abs(a.w) || a.j - b.j)
    .slice(0, TOP_FEATURES);
  const max = Math.max(1e-12, ...top.map((e) => Math.abs(e.w)));
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-medium">{title}</figcaption>
      <ul className="space-y-1">
        {top.map(({ w, j }) => (
          <li key={j} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-2 text-xs">
            <span className="truncate" title={featureNames[j]}>{featureNames[j]}</span>
            <span aria-hidden="true" className="relative h-3 rounded-sm bg-rule/40">
              <span className="absolute inset-y-0 left-1/2 w-px bg-ink/40" />
              <span className="absolute inset-y-0 rounded-sm" style={{ left: w >= 0 ? '50%' : `${50 - (Math.abs(w) / max) * 50}%`, width: `${(Math.abs(w) / max) * 50}%`, backgroundColor: w >= 0 ? POSITIVE : NEGATIVE }} />
            </span>
            <span className="text-right font-mono">{w.toLocaleString(i18n.language, { maximumFractionDigits: 3 })}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
