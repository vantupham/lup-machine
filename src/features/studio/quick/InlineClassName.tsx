import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ClassMarker } from '@/ui/ClassMarker';
import { Pencil } from '@/ui/icons';

/** Tên lớp / nhóm dài nhất (khớp với ô sửa tên ở bước 1). */
const MAX_NAME_LENGTH = 40;

interface InlineClassNameProps {
  readonly name: string;
  readonly markerIndex: number;
  /** Lưu tên mới; trả về false nếu lỗi để ô sửa vẫn mở. */
  readonly onRename: (name: string) => Promise<boolean>;
}

/** Tên lớp kèm nút bút chì; bấm vào thì thành ô sửa tên ngay tại chỗ (Enter lưu, Esc hủy). */
export function InlineClassName({ name, markerIndex, onRename }: InlineClassNameProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate font-semibold">
          <ClassMarker index={markerIndex} className="mr-1.5" />
          {name}
        </p>
        <button
          type="button"
          onClick={() => setDraft(name)}
          aria-label={t('project.class.renameAria', { name })}
          title={t('project.class.rename')}
          className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil />
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = draft.trim();
    if (!next || next === name || (await onRename(next))) setDraft(null);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <input
        aria-label={t('project.class.renameLabel')}
        value={draft}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDraft(null);
        }}
        className="min-w-0 flex-1 rounded border border-rule bg-paper px-2 py-1 text-sm"
      />
      <button type="submit" className="btn btn-primary px-2.5 py-1 text-sm">
        {t('project.class.save')}
      </button>
      <button type="button" onClick={() => setDraft(null)} className="text-sm">
        {t('project.class.cancel')}
      </button>
    </form>
  );
}
