import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NOTE_TEXT_MAX_LENGTH } from '@/storage/schemas/notebook';
import { getErrorMessage } from '@/ui/error-message';
import { ChevronDown, ChevronUp, NotebookPen } from '@/ui/icons';
import { useNotebook, type NotebookContextValue } from './NotebookContext';

/** Gõ xong ngần này mili-giây thì tự lưu (rời ô ghi chép thì lưu ngay). */
export const NOTE_SAVE_DELAY_MS = 800;
const QUESTION_KINDS = ['observe', 'explain'] as const;

type SaveState = { readonly kind: 'idle' | 'saving' | 'saved' } | { readonly kind: 'error'; readonly message: string };

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
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const isMounted = useRef(true);
  const { projectId, projectType, repository, status } = notebook;

  const text = draft ?? notebook.textOf(step);
  const hasText = text.trim() !== '';

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    if (isMounted.current) setSave({ kind: 'saving' });
    try {
      await repository.save(projectId, step, value);
      if (isMounted.current && pending.current === null) setSave({ kind: 'saved' });
    } catch (error: unknown) {
      console.error('Không lưu được ghi chép', projectId, step, error);
      if (isMounted.current) setSave({ kind: 'error', message: getErrorMessage(error) });
    }
  }, [repository, projectId, step]);

  // Rời trang khi còn chữ chưa lưu: lưu nốt.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      void flush();
    };
  }, [flush]);

  const onChange = (value: string) => {
    setDraft(value);
    notebook.remember(step, value);
    pending.current = value;
    setSave({ kind: 'idle' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), NOTE_SAVE_DELAY_MS);
  };

  const toggle = () => {
    if (isOpen) void flush();
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
              onBlur={() => void flush()}
              maxLength={NOTE_TEXT_MAX_LENGTH}
              rows={4}
              disabled={status !== 'ready'}
              placeholder={t('notebook.placeholder')}
              className="w-full rounded border border-rule bg-paper p-2 text-ink"
            />
          </label>
          {save.kind === 'error' ? (
            <p role="alert" className="text-xs text-danger">{t('notebook.saveError', { message: save.message })}</p>
          ) : (
            <p role="status" className="text-xs text-muted">
              {save.kind === 'saving' ? t('notebook.saving') : save.kind === 'saved' ? t('notebook.saved') : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
