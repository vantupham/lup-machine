import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSV_LIMITS, parseCsv, type ParsedTable } from '@/core/tabular/csv';
import type { ColumnSummary } from '@/core/tabular/columns';
import type { PrepareError, PreparedData } from '@/core/tabular/prepare';
import type { TabularConfig } from '@/storage/schemas/tabular';
import { getErrorMessage } from '@/ui/error-message';
import { PacedQuickTrain } from '@/features/studio/quick/PacedQuickTrain';
import { QuickLayout } from '@/features/studio/quick/QuickLayout';
import { accuracyScore, r2Score } from '@/features/studio/quick/score-text';
import { renameValue } from '@/features/studio/quick/table-edit';
import { csvErrorKey } from '../DataSection';
import type { TabularSampleId } from '../tabular-samples';
import type { TabularModel } from '../useTabularModel';
import { TabularQuickData } from './TabularQuickData';
import { TabularQuickPreview } from './TabularQuickPreview';

interface TabularQuickWorkspaceProps {
  readonly fileName: string | null;
  readonly parsed: ParsedTable | null;
  readonly columns: readonly ColumnSummary[];
  readonly config: TabularConfig | null;
  readonly data: PreparedData | null;
  readonly prepareError: PrepareError | null;
  readonly model: TabularModel;
  readonly onConfigChange: (config: TabularConfig) => void;
  /** Thay cả bảng (mẫu hoặc tệp mới). */
  readonly onReplace: (csv: string, fileName: string, sampleId: TabularSampleId | null) => Promise<void>;
  /** Sửa bảng hiện tại (giữ cài đặt cũ nếu còn hợp lệ). */
  readonly onEdit: (csv: string) => Promise<void>;
  readonly loadSample: (id: TabularSampleId) => Promise<{ readonly csv: string; readonly fileName: string } | null>;
}

/** Chế độ Khám phá của Studio bảng số: chọn bảng và cột cần đoán → học → thử từng dòng. */
export function TabularQuickWorkspace(props: TabularQuickWorkspaceProps) {
  const { t, i18n } = useTranslation();
  const { parsed, config, data, model, prepareError } = props;
  const [isChoosing, setIsChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (err: unknown) {
      setError(t('tabular.saveError', { message: getErrorMessage(err) }));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const replace = (csv: string, fileName: string, sampleId: TabularSampleId | null) => {
    const result = parseCsv(csv);
    if (!result.ok) {
      const [key, params] = csvErrorKey(result);
      setError(t(key, params));
      return;
    }
    void run(async () => {
      await props.onReplace(csv, fileName, sampleId);
      setIsChoosing(false);
    });
  };

  const renameClass = async (from: string, to: string): Promise<boolean> => {
    if (data?.classNames.includes(to)) {
      setError(t('text.quick.duplicateName'));
      return false;
    }
    return parsed && config ? run(() => props.onEdit(renameValue(parsed, config.target, from, to))) : false;
  };

  const evaluation = model.evaluation;
  const score =
    evaluation?.task === 'classification'
      ? accuracyScore(t, evaluation.test.accuracy, evaluation.train.accuracy)
      : evaluation?.task === 'regression'
        ? r2Score(t, i18n.language, evaluation.test.r2, evaluation.train.r2)
        : null;
  const notReady = prepareError ? t(`tabular.prepareErrors.${prepareError.code}`, prepareError) : parsed ? null : t('tabular.quick.needTable');

  return (
    <QuickLayout lead={t('tabular.quick.lead')} columns={[t('tabular.quick.columns.data'), t('tabular.quick.columns.train'), t('tabular.quick.columns.preview')]}>
      <TabularQuickData
        fileName={props.fileName}
        rowCount={parsed?.rows.length ?? 0}
        columns={props.columns}
        config={config}
        data={data}
        isChoosing={isChoosing}
        busy={busy}
        error={error}
        onChoose={setIsChoosing}
        onLoadSample={(id) =>
          void props.loadSample(id).then((sample) => {
            if (sample) replace(sample.csv, sample.fileName, id);
          })
        }
        onUpload={(file) => {
          if (file.size > CSV_LIMITS.maxChars) return setError(t('tabular.csvErrors.too-large'));
          void file.text().then((csv) => replace(csv, file.name, null));
        }}
        onConfigChange={props.onConfigChange}
        onRenameClass={renameClass}
      />
      <PacedQuickTrain
        stages={[
          { label: t('tabular.quick.encode', { count: data?.featureNames.length ?? 0 }), detail: data ? t('tabular.data.rowCount', { n: data.train.y.length + data.test.y.length }) : null },
          { label: t('project.quick.vector.split'), detail: data ? t('project.quick.vector.splitDetail', { train: data.train.y.length, test: data.test.y.length }) : null },
          { label: t('project.quick.vector.learn', { model: t(`tabular.models.${config?.model.kind ?? 'tree'}.name`) }), detail: null },
          { label: t('project.quick.vector.score'), detail: score?.detail ?? null },
        ]}
        trainStage={2}
        onTrain={model.train}
        hasModel={model.current !== null}
        isStale={model.trained !== null && model.current === null}
        result={score?.result ?? null}
        notReady={notReady}
        trainHeadingId="tab-step-train"
      />
      <TabularQuickPreview model={model.current} data={data} />
    </QuickLayout>
  );
}
