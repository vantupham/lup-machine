import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PythonProgram } from '@/core/trace/program';
import { tokenizeLine, type TokenKind } from '@/core/trace/python-tokens';

const TOKEN_CLASS: Record<TokenKind, string> = {
  keyword: 'font-semibold text-primary',
  builtin: 'text-primary',
  string: 'text-accent',
  number: 'text-warning',
  comment: 'italic text-muted',
  plain: '',
};

interface CodeViewProps {
  readonly program: PythonProgram;
  /** Dòng (từ 0) đang chạy, được tô sáng. */
  readonly activeLine?: number | null;
}

/** Mã Python có số dòng và tô màu; dòng đang chạy được đánh dấu bằng nền và aria-current. */
export const CodeView = memo(function CodeView({ program, activeLine = null }: CodeViewProps) {
  const { t } = useTranslation();
  const tokens = useMemo(() => program.lines.map(tokenizeLine), [program]);
  return (
    <div className="overflow-x-auto rounded border border-rule bg-paper">
      <p className="border-b border-rule px-3 py-1 font-mono text-xs text-muted">{program.fileName}</p>
      <ol className="py-2 font-mono text-xs leading-5" aria-label={program.fileName}>
        {tokens.map((lineTokens, i) => {
          const isActive = i === activeLine;
          return (
            <li
              key={i}
              aria-current={isActive ? 'step' : undefined}
              className={`flex whitespace-pre border-l-4 pr-3 ${isActive ? 'border-primary bg-highlight/40' : 'border-transparent'}`}
            >
              <span aria-hidden="true" className="w-9 shrink-0 select-none pr-3 text-right text-muted">{i + 1}</span>
              {isActive && <span className="sr-only">{t('codeTrace.current')} </span>}
              <code>
                {lineTokens.map((token, j) => (
                  <span key={j} className={TOKEN_CLASS[token.kind]}>{token.text}</span>
                ))}
              </code>
            </li>
          );
        })}
      </ol>
    </div>
  );
});
