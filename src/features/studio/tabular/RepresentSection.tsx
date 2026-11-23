import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PreparedData } from '@/core/tabular/prepare';
import { Plot2d } from '@/features/playground/Plot2d';
import { ExactBadge } from '@/ui/ExactBadge';

/** Miền hiển thị ±3,5 độ lệch chuẩn; điểm xa hơn được kẹp ở mép. */
const DOMAIN = 3.5;

function clamp(v: number): number {
  return Math.max(-DOMAIN * 0.98, Math.min(DOMAIN * 0.98, v));
}

function zScores(values: readonly number[]): number[] {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length) || 1;
  return values.map((v) => (v - m) / sd);
}

function StandardizeTable({ data }: { readonly data: PreparedData }) {
  const { t } = useTranslation();
  const raw = data.train.raw[0];
  const scaled = data.train.scaled[0];
  if (!raw || !scaled) return null;
  // vị trí bắt đầu của mỗi cột gốc trong vector đã mã hóa (cột phân loại chiếm nhiều ô)
  const starts = data.encoders.map((_, i) =>
    data.encoders.slice(0, i).reduce((n, e) => n + (e.kind === 'numeric' ? 1 : e.categories.length), 0),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-1 text-left text-sm font-medium">{t('tabular.represent.tableCaption', { row: data.train.rowNumbers[0] })}</caption>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1 pr-2">{t('tabular.represent.column')}</th>
            <th scope="col" className="py-1 pr-2">{t('tabular.represent.original')}</th>
            <th scope="col" className="py-1 pr-2">{t('tabular.represent.how')}</th>
            <th scope="col" className="py-1">{t('tabular.represent.modelSees')}</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {data.encoders.map((e, i) => {
            const start = starts[i] as number;
            if (e.kind === 'numeric') {
              return (
                <tr key={e.name} className="border-t border-rule">
                  <th scope="row" className="py-1 pr-2 text-left font-sans font-medium">{e.name}</th>
                  <td className="py-1 pr-2">{raw[start]}</td>
                  <td className="py-1 pr-2">({raw[start]} − {e.mean.toFixed(2)}) ÷ {e.std.toFixed(2)}</td>
                  <td className="py-1">{(scaled[start] as number).toFixed(3)}</td>
                </tr>
              );
            }
            const bits = raw.slice(start, start + e.categories.length);
            return (
              <tr key={e.name} className="border-t border-rule">
                <th scope="row" className="py-1 pr-2 text-left font-sans font-medium">{e.name}</th>
                <td className="py-1 pr-2">{e.categories[bits.indexOf(1)] ?? '—'}</td>
                <td className="py-1 pr-2 font-sans">{t('tabular.represent.oneHot', { categories: e.categories.join(' | ') })}</td>
                <td className="py-1">[{bits.join(', ')}]</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RepresentSection({ data }: { readonly data: PreparedData }) {
  const { t } = useTranslation();
  const xId = useId();
  const yId = useId();
  const numeric = data.featureNames
    .map((name, index) => ({ name, index }))
    .filter(({ index }) => data.encoders.some((e) => e.kind === 'numeric' && e.name === data.featureNames[index]));
  const yOptions = data.task === 'regression' ? [{ name: data.target, index: -1 }, ...numeric] : numeric;
  const defaultX = numeric[0]?.index ?? -2;
  const defaultY = yOptions.find((o) => o.index !== defaultX)?.index ?? -2;
  const [xChoice, setXIndex] = useState(defaultX);
  const [yChoice, setYIndex] = useState(defaultY);
  // các cột đặc trưng có thể đã đổi: lựa chọn cũ không còn thì quay về mặc định
  const xIndex = numeric.some((n) => n.index === xChoice) ? xChoice : defaultX;
  const yIndex = yOptions.some((o) => o.index === yChoice) ? yChoice : defaultY;

  const all = useMemo(() => ({
    scaled: [...data.train.scaled, ...data.test.scaled],
    y: [...data.train.y, ...data.test.y],
  }), [data]);
  const targetZ = useMemo(() => (data.task === 'regression' ? zScores(all.y) : []), [data.task, all.y]);
  const valid = numeric.some((n) => n.index === xIndex) && yOptions.some((o) => o.index === yIndex);
  const coord = (i: number, index: number) => (index === -1 ? (targetZ[i] as number) : (all.scaled[i]![index] as number));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{t('tabular.represent.mapTitle')}</h3>
          <ExactBadge label={t('playground.exact')} hint={t('tabular.represent.mapHint')} />
        </div>
        {valid ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label htmlFor={xId}>{t('tabular.represent.xAxis')}
                <select id={xId} value={xIndex} onChange={(e) => setXIndex(Number(e.target.value))} className="mt-1 w-full rounded border border-rule bg-surface px-2 py-1">
                  {numeric.map((o) => <option key={o.index} value={o.index}>{o.name}</option>)}
                </select>
              </label>
              <label htmlFor={yId}>{t('tabular.represent.yAxis')}
                <select id={yId} value={yIndex} onChange={(e) => setYIndex(Number(e.target.value))} className="mt-1 w-full rounded border border-rule bg-surface px-2 py-1">
                  {yOptions.map((o) => <option key={o.index} value={o.index}>{o.name}</option>)}
                </select>
              </label>
            </div>
            <Plot2d
              label={t('tabular.represent.plotLabel')}
              domain={DOMAIN}
              points={all.y.map((y, i) => ({
                x: clamp(coord(i, xIndex)),
                y: clamp(coord(i, yIndex)),
                label: data.task === 'classification' ? y : 0,
              }))}
            />
            <p className="text-xs text-muted">{t('tabular.represent.axisNote')}</p>
          </>
        ) : (
          <p className="text-sm text-muted">{t('tabular.represent.needNumeric')}</p>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{t('tabular.represent.tableTitle')}</h3>
          <ExactBadge label={t('playground.exact')} hint={t('tabular.represent.tableHint')} />
        </div>
        <StandardizeTable data={data} />
        <p className="text-xs text-muted">{t('tabular.represent.whyScale')}</p>
      </div>
    </div>
  );
}
