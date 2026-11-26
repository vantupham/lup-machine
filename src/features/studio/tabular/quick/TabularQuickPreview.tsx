import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { predictRow, type TrainedModel } from '@/core/tabular/models';
import type { PreparedData } from '@/core/tabular/prepare';
import { ProbaBars } from '@/features/studio/quick/ProbaBars';
import { ArrowRight } from '@/ui/icons';

interface TabularQuickPreviewProps {
  readonly model: TrainedModel | null;
  readonly data: PreparedData | null;
}

/** Cột 3: thử lần lượt từng dòng Kiểm tra (máy chưa thấy khi học): máy đoán gì, thật là gì. */
export function TabularQuickPreview({ model, data }: TabularQuickPreviewProps) {
  const { t } = useTranslation();
  if (!model || !data) return <p className="text-sm text-muted">{t('project.quick.needModel')}</p>;
  if (data.test.y.length === 0) return <p className="text-sm text-muted">{t('tabular.quick.noTestRows')}</p>;
  return <RowTrial model={model} data={data} />;
}

function RowTrial({ model, data }: { readonly model: TrainedModel; readonly data: PreparedData }) {
  const { t, i18n } = useTranslation();
  const [index, setIndex] = useState<number | null>(null);
  const count = data.test.y.length;
  const i = index === null ? null : index % count;
  const prediction = i === null ? null : predictRow(model, { raw: data.test.raw[i] as number[], scaled: data.test.scaled[i] as number[] });
  const format = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const actual = i === null ? null : (data.test.y[i] as number);

  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" onClick={() => setIndex((n) => (n === null ? 0 : n + 1))}>
        <ArrowRight /> {t(index === null ? 'tabular.quick.tryFirst' : 'tabular.quick.tryNext')}
      </button>
      {i !== null && prediction && actual !== null && (
        <>
          <p className="text-sm">
            {t('tabular.quick.rowActual', {
              row: data.test.rowNumbers[i],
              target: data.target,
              actual: data.task === 'classification' ? data.classNames[actual] : format(actual),
            })}
          </p>
          {data.task === 'classification' && prediction.proba ? (
            <ProbaBars classNames={data.classNames} probabilities={prediction.proba} />
          ) : (
            <p className="text-lg font-semibold" data-testid="quick-regression">
              {t('tabular.quick.predictedValue', { value: format(prediction.value) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
