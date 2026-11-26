import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { explainText, type TextData, type TrainedText } from '@/core/text/text-model';
import { ProbaBars } from '@/features/studio/quick/ProbaBars';

interface TextQuickPreviewProps {
  readonly model: TrainedText | null;
  readonly data: TextData | null;
}

/** Cột 3: gõ một câu để thử ngay; câu thử không được lưu. */
export function TextQuickPreview({ model, data }: TextQuickPreviewProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [text, setText] = useState('');
  if (!model || !data) return <p className="text-sm text-muted">{t('project.quick.needModel')}</p>;
  const explanation = text.trim() ? explainText(model, data, text) : null;

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="text-sm font-medium">
        {t('text.quick.tryInput')}
      </label>
      <textarea id={inputId} rows={2} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border border-rule bg-paper p-2 text-sm" />
      {explanation && explanation.contributions.length === 0 && <p className="text-sm text-warning">{t('text.use.noKnownWords')}</p>}
      {explanation && <ProbaBars classNames={data.classNames} probabilities={explanation.proba} />}
    </div>
  );
}
