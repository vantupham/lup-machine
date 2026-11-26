import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParsedTable } from '@/core/tabular/csv';
import type { TextData, TextExample, TextPrepareError } from '@/core/text/text-model';
import type { TextConfig } from '@/storage/schemas/text';
import { getErrorMessage } from '@/ui/error-message';
import { nextClassName } from '@/features/studio/next-class-name';
import { PacedQuickTrain } from '@/features/studio/quick/PacedQuickTrain';
import { QuickLayout } from '@/features/studio/quick/QuickLayout';
import { accuracyScore } from '@/features/studio/quick/score-text';
import { addSentence, renameLabel, textGroups } from '../text-edit';
import type { TextSampleId } from '../text-samples';
import type { TextModel } from '../useTextModel';
import { TextQuickClasses } from './TextQuickClasses';
import { TextQuickPreview } from './TextQuickPreview';

/** Chưa có bảng: hai nhóm trống để gõ câu ngay. */
const STARTER_GROUPS = 2;

interface TextQuickWorkspaceProps {
  readonly parsed: ParsedTable | null;
  readonly config: TextConfig | null;
  readonly examples: readonly TextExample[];
  readonly data: TextData | null;
  readonly prepareError: TextPrepareError | null;
  readonly model: TextModel;
  /** Lưu bảng câu mới (giữ cài đặt cũ nếu còn hợp lệ). */
  readonly onSaveCsv: (csv: string) => Promise<void>;
  readonly onLoadSample: (id: TextSampleId) => Promise<void>;
}

/** Chế độ Khám phá của Studio văn bản: gõ câu → học → thử ngay trên một màn hình. */
export function TextQuickWorkspace({ parsed, config, examples, data, prepareError, model, onSaveCsv, onLoadSample }: TextQuickWorkspaceProps) {
  const { t } = useTranslation();
  const defaultName = (n: number) => t('text.editor.defaultClass', { n });
  /** Nhóm mới chưa có câu nào: chưa nằm trong bảng nên giữ ở đây tới khi có câu đầu tiên. */
  const [pending, setPending] = useState<readonly string[]>(() => (parsed ? [] : Array.from({ length: STARTER_GROUPS }, (_, i) => defaultName(i + 1))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = textGroups(examples);
  const savedNames = new Set(saved.map((g) => g.name));
  const groups = [...saved, ...pending.filter((name) => !savedNames.has(name)).map((name) => ({ name, count: 0 }))];
  const allNames = groups.map((g) => g.name);

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

  const rename = async (from: string, to: string): Promise<boolean> => {
    if (allNames.includes(to)) {
      setError(t('text.quick.duplicateName'));
      return false;
    }
    setError(null);
    if (!savedNames.has(from)) {
      setPending((list) => list.map((name) => (name === from ? to : name)));
      return true;
    }
    return parsed && config ? run(() => onSaveCsv(renameLabel(parsed, config, from, to))) : false;
  };

  const tokenizeDetail = data ? t('text.quick.tokenizeDetail', { words: data.vocab.terms.length }) : null;
  const score = model.evaluation ? accuracyScore(t, model.evaluation.testAccuracy, model.evaluation.trainAccuracy) : null;
  const notReady = prepareError ? t(`text.prepareErrors.${prepareError.code}`, prepareError) : parsed ? null : t('text.quick.needSentences');

  return (
    <QuickLayout lead={t('text.quick.lead')} columns={[t('text.quick.columns.data'), t('text.quick.columns.train'), t('text.quick.columns.preview')]}>
      <TextQuickClasses
        groups={groups}
        hasTable={parsed !== null}
        busy={busy}
        error={error}
        onAddSentence={(group, text) => run(() => onSaveCsv(addSentence(parsed, config, group, text)))}
        onRename={rename}
        onAddGroup={() => setPending((list) => [...list, nextClassName(allNames, defaultName)])}
        onLoadSample={(id) =>
          void run(async () => {
            await onLoadSample(id);
            setPending([]);
          })
        }
      />
      <PacedQuickTrain
        stages={[
          { label: t('text.quick.tokenize', { count: examples.length }), detail: tokenizeDetail },
          { label: t('project.quick.vector.split'), detail: data ? t('project.quick.vector.splitDetail', { train: data.train.y.length, test: data.test.y.length }) : null },
          { label: t('project.quick.vector.learn', { model: t(`text.models.${config?.model.kind ?? 'naive-bayes'}.name`) }), detail: null },
          { label: t('project.quick.vector.score'), detail: score?.detail ?? null },
        ]}
        trainStage={2}
        onTrain={model.train}
        hasModel={model.current !== null}
        isStale={model.trained !== null && model.current === null}
        result={score?.result ?? null}
        notReady={notReady}
        trainHeadingId="text-step-train"
      />
      <TextQuickPreview model={model.current} data={data} />
    </QuickLayout>
  );
}
