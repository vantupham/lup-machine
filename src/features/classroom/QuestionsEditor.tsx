import { useTranslation } from 'react-i18next';
import { ASSIGNMENT_LIMITS } from '@/storage/schemas/assignment';
import { X } from '@/ui/icons';

interface QuestionsEditorProps {
  readonly questions: readonly string[];
  readonly onChange: (questions: string[]) => void;
}

/** Danh sách câu hỏi phiếu thí nghiệm: thêm, sửa, xóa (tối đa 10 câu). */
export function QuestionsEditor({ questions, onChange }: QuestionsEditorProps) {
  const { t } = useTranslation();
  const replace = (index: number, value: string) => onChange(questions.map((q, i) => (i === index ? value : q)));

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{t('classroom.create.questionsTitle')}</legend>
      <p className="text-xs text-muted">{t('classroom.create.questionsHint', { max: ASSIGNMENT_LIMITS.questions })}</p>
      <ol className="space-y-2">
        {questions.map((question, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              aria-label={t('classroom.create.questionLabel', { n: i + 1 })}
              value={question}
              maxLength={ASSIGNMENT_LIMITS.question}
              onChange={(e) => replace(i, e.target.value)}
              className="w-full rounded border border-rule bg-paper px-3 py-2"
            />
            <button
              type="button"
              aria-label={t('classroom.create.removeQuestion', { n: i + 1 })}
              onClick={() => onChange(questions.filter((_, j) => j !== i))}
              className="btn btn-ghost px-2 py-1 text-sm"
            >
              <X />
            </button>
          </li>
        ))}
      </ol>
      {questions.length < ASSIGNMENT_LIMITS.questions && (
        <button type="button" onClick={() => onChange([...questions, ''])} className="btn btn-ghost text-sm">
          {t('classroom.create.addQuestion')}
        </button>
      )}
    </fieldset>
  );
}
