import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCsv } from '@/core/tabular/csv';
import type { TextExample } from '@/core/text/text-model';
import { EDITOR_COLUMNS } from './text-samples';
import { ClassMarker } from '@/ui/ClassMarker';

interface ClassDraft {
  readonly name: string;
  readonly lines: string;
}

const MAX_CLASSES = 10;
const MAX_NAME_LENGTH = 40;

/** Gom các câu theo nhãn để sửa: mỗi lớp một ô, mỗi dòng một câu. */
export function draftsFrom(examples: readonly TextExample[]): ClassDraft[] {
  const groups = new Map<string, string[]>();
  for (const e of examples) {
    const label = e.label.trim();
    if (!label) continue;
    groups.set(label, [...(groups.get(label) ?? []), e.text.replace(/\s*\n\s*/g, ' ').trim()]);
  }
  return [...groups.entries()].map(([name, lines]) => ({ name, lines: lines.join('\n') }));
}

/** Ghép các ô thành bảng CSV hai cột (nhãn, văn bản); bỏ dòng trống. */
export function draftsToCsv(drafts: readonly ClassDraft[]): string {
  const rows = drafts.flatMap((d) =>
    d.lines
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && d.name.trim() !== '')
      .map((l) => [d.name.trim(), l]),
  );
  return formatCsv([EDITOR_COLUMNS.label, EDITOR_COLUMNS.text], rows);
}

interface SentenceEditorProps {
  readonly initial: readonly TextExample[];
  readonly onSave: (csv: string) => Promise<void>;
  readonly onCancel: (() => void) | null;
}

export function SentenceEditor({ initial, onSave, onCancel }: SentenceEditorProps) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<ClassDraft[]>(() => {
    const fromData = draftsFrom(initial);
    return fromData.length > 0 ? fromData : [{ name: t('text.editor.defaultClass', { n: 1 }), lines: '' }, { name: t('text.editor.defaultClass', { n: 2 }), lines: '' }];
  });
  const [busy, setBusy] = useState(false);
  const names = drafts.map((d) => d.name.trim());
  const hasDuplicateName = new Set(names).size !== names.length;
  const hasEmptyName = names.some((n) => n === '');

  const update = (i: number, patch: Partial<ClassDraft>) => setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {drafts.map((d, i) => (
          <div key={i} className="lab-card space-y-2 p-3">
            <div className="flex items-center gap-2">
              <ClassMarker index={i} />
              <input
                aria-label={t('text.editor.className', { n: i + 1 })}
                value={d.name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => update(i, { name: e.target.value })}
                className="flex-1 rounded border border-rule bg-paper px-2 py-1 font-semibold"
              />
              <button type="button" className="btn btn-ghost px-2 py-1 text-xs" disabled={drafts.length <= 2} onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>
                {t('text.editor.removeClass')}
              </button>
            </div>
            <textarea
              aria-label={t('text.editor.sentencesOf', { name: d.name || t('text.editor.defaultClass', { n: i + 1 }) })}
              value={d.lines}
              rows={6}
              onChange={(e) => update(i, { lines: e.target.value })}
              placeholder={t('text.editor.placeholder')}
              className="w-full rounded border border-rule bg-paper p-2 text-sm"
            />
            <p className="text-xs text-muted">{t('text.editor.count', { n: d.lines.split('\n').filter((l) => l.trim() !== '').length })}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost text-sm"
          disabled={drafts.length >= MAX_CLASSES}
          onClick={() => setDrafts([...drafts, { name: t('text.editor.defaultClass', { n: drafts.length + 1 }), lines: '' }])}
        >
          {t('text.editor.addClass')}
        </button>
        <button
          type="button"
          className="btn btn-primary text-sm"
          disabled={busy || hasDuplicateName || hasEmptyName}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(draftsToCsv(drafts));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('text.editor.save')}
        </button>
        {onCancel && <button type="button" className="btn btn-ghost text-sm" onClick={onCancel}>{t('tabular.data.cancel')}</button>}
      </div>
      {(hasDuplicateName || hasEmptyName) && <p role="alert" className="text-sm text-danger">{t('text.editor.nameError')}</p>}
    </div>
  );
}
