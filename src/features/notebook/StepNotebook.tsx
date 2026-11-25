import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_TEXT_MAX_LENGTH } from '@/storage/schemas/notebook';
import { AutosaveStatus } from '@/ui/AutosaveStatus';
import { ChevronDown, ChevronUp, NotebookPen } from '@/ui/icons';
import { useAutosave } from '@/ui/useAutosave';
import { useNotebook, type NotebookContextValue } from './NotebookContext';

const QUESTION_KINDS = ['observe', 'explain'] as const;

interface StepNotebookProps {
  /** Tên bước (data, check, represent, train, evaluate, use). */
  readonly step: string;
}

/**
 * Sổ tay của một bước: một câu hỏi quan sát (mô tả) và một câu hỏi "vì sao" (giải thích),
 * kèm ô ghi chép lưu vào dự án. Thu gọn sẵn để trang không dài thêm.
 */
export function StepNotebook({ step }: StepNotebookProps) {
  const notebook = useNotebook();
  if (!notebook) return null;
  return <NotebookBox notebook={notebook} step={step} />;
}

function NotebookBox({ notebook, step }: { readonly notebook: NotebookContextValue; readonly step: string }) {
  const { t } = useTranslation();
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const { projectId, projectType, repository, status } = notebook;
  const save = useCallback((value: string) => repository.save(projectId, step, value), [repository, projectId, step]);
  const autosave = useAutosave(save);

  const text = draft ?? notebook.textOf(step);
  const hasText = text.trim() !== '';

  const onChange = (value: string) => {
    setDraft(value);
    notebook.remember(step, value);
    autosave.schedule(value);
  };

  const toggle = () => {
    if (isOpen) void autosave.flush();
    setIsOpen(!isOpen);
  };

  return (
    <div className="rounded border border-dashed border-rule p-3" data-testid={`notebook-${step}`}>
      <button type="button" aria-expanded={isOpen} aria-controls={`${id}-body`} onClick={toggle} className="flex items-center gap-2 text-sm font-medium">
        <NotebookPen />
        {t('notebook.title')}
        <span className="font-normal text-muted">· {hasText ? t('notebook.written') : t('notebook.questions', { count: QUESTION_KINDS.length })}</span>
        {isOpen ? <ChevronUp /> : <ChevronDown />}
      </button>
      {isOpen && (
        <div id={`${id}-body`} className="mt-3 space-y-3">
          <dl className="space-y-1 text-sm">
            {QUESTION_KINDS.map((kind) => (
              <div key={kind} className="flex gap-2">
                <dt className="shrink-0 font-medium">{t(`notebook.${kind}`)}:</dt>
                <dd>{t(`notebook.${projectType}.${step}.${kind}`)}</dd>
              </div>
            ))}
          </dl>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">{t('notebook.label')}</span>
            <textarea
              value={text}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => void autosave.flush()}
              maxLength={NOTE_TEXT_MAX_LENGTH}
              rows={4}
              disabled={status !== 'ready'}
              placeholder={t('notebook.placeholder')}
              className="w-full rounded border border-rule bg-paper p-2 text-ink"
            />
          </label>
          <AutosaveStatus state={autosave.state} />
        </div>
      )}
    </div>
  );
}
