import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizQuestion } from '@/content/lessons';

interface QuizProps {
  readonly questions: readonly QuizQuestion[];
}

/** Câu hỏi trắc nghiệm có phản hồi ngay và giải thích. Không lưu, không chấm điểm chính thức. */
export function Quiz({ questions }: QuizProps) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<ReadonlyMap<number, number>>(new Map());
  const correctCount = questions.filter((q, i) => answers.get(i) === q.correct).length;

  return (
    <div className="space-y-5">
      {questions.map((q, qi) => {
        const chosen = answers.get(qi);
        const isAnswered = chosen !== undefined;
        return (
          <fieldset key={q.question} className="space-y-2" lang="vi">
            <legend className="mb-2 font-medium">
              {qi + 1}. {q.question}
            </legend>
            {q.options.map((option, oi) => (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm ${
                  isAnswered && oi === q.correct ? 'border-accent bg-accent/10' : isAnswered && oi === chosen ? 'border-danger bg-danger/10' : 'border-rule'
                }`}
              >
                <input
                  type="radio"
                  name={`quiz-${qi}`}
                  checked={chosen === oi}
                  disabled={isAnswered}
                  onChange={() => setAnswers((prev) => new Map(prev).set(qi, oi))}
                  className="mt-1"
                />
                {option}
              </label>
            ))}
            {isAnswered && (
              <p role="status" className="text-sm">
                <strong className={chosen === q.correct ? 'text-accent' : 'text-danger'}>
                  {t(chosen === q.correct ? 'lessons.correct' : 'lessons.incorrect')}
                </strong>{' '}
                {q.explanation}
              </p>
            )}
          </fieldset>
        );
      })}
      {answers.size === questions.length && (
        <div className="flex items-center gap-4">
          <p className="font-semibold">{t('lessons.score', { correct: correctCount, total: questions.length })}</p>
          <button type="button" className="btn btn-ghost text-sm" onClick={() => setAnswers(new Map())}>
            {t('lessons.retry')}
          </button>
        </div>
      )}
    </div>
  );
}
