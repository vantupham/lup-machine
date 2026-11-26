import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineClassName } from '@/features/studio/quick/InlineClassName';
import { Plus } from '@/ui/icons';
import type { TextGroup } from '../text-edit';
import { TEXT_SAMPLES, type TextSampleId } from '../text-samples';

interface TextQuickClassesProps {
  /** Các nhóm đã có câu (trong bảng) và các nhóm mới chưa có câu nào. */
  readonly groups: readonly TextGroup[];
  readonly hasTable: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onAddSentence: (group: string, text: string) => Promise<boolean>;
  readonly onRename: (from: string, to: string) => Promise<boolean>;
  readonly onAddGroup: () => void;
  readonly onLoadSample: (id: TextSampleId) => void;
}

/** Cột 1: mỗi nhóm một dòng: đổi tên, số câu, ô gõ câu mới (Enter để thêm). Chưa có bảng thì có bộ câu mẫu. */
export function TextQuickClasses({ groups, hasTable, busy, error, onAddSentence, onRename, onAddGroup, onLoadSample }: TextQuickClassesProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {!hasTable && (
        <div className="space-y-2">
          <p className="text-sm text-muted">{t('text.quick.empty')}</p>
          {TEXT_SAMPLES.map((s) => (
            <button key={s.id} type="button" disabled={busy} className="btn btn-ghost w-full justify-between text-left text-sm" onClick={() => onLoadSample(s.id)}>
              <span>{t(`text.samples.${s.id}`)}</span>
              <span className="font-mono text-xs text-muted">{t('text.data.sentenceCount', { n: s.sentences })}</span>
            </button>
          ))}
        </div>
      )}
      {groups.map((group, i) => (
        <GroupRow key={group.name} group={group} index={i} busy={busy} onAddSentence={onAddSentence} onRename={onRename} />
      ))}
      <button type="button" className="btn btn-ghost w-full justify-center border-dashed text-sm" disabled={busy} onClick={onAddGroup}>
        <Plus /> {t('text.editor.addClass')}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface GroupRowProps {
  readonly group: TextGroup;
  readonly index: number;
  readonly busy: boolean;
  readonly onAddSentence: (group: string, text: string) => Promise<boolean>;
  readonly onRename: (from: string, to: string) => Promise<boolean>;
}

function GroupRow({ group, index, busy, onAddSentence, onRename }: GroupRowProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim() === '') return;
    if (await onAddSentence(group.name, draft)) setDraft('');
  };

  return (
    <div role="group" aria-label={group.name} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <InlineClassName name={group.name} markerIndex={index} onRename={(name) => onRename(group.name, name)} />
        <span className="shrink-0 font-mono text-xs text-muted">{t('text.data.sentenceCount', { n: group.count })}</span>
      </div>
      <form onSubmit={(e) => void submit(e)} className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={t('text.quick.sentenceInput', { name: group.name })}
          placeholder={t('text.quick.placeholder')}
          className="min-w-0 flex-1 rounded border border-rule bg-paper px-2 py-1 text-sm"
        />
        <button type="submit" className="btn btn-ghost px-2.5 py-1 text-sm" disabled={busy || draft.trim() === ''} aria-label={t('text.quick.addAria', { name: group.name })}>
          <Plus /> {t('text.quick.add')}
        </button>
      </form>
    </div>
  );
}
