import { useTranslation } from 'react-i18next';
import { useInlineEdit } from '@/features/studio/useInlineEdit';
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

/** Tên lớp kèm nút bút chì; bấm vào thì thành ô sửa tên ngay tại chỗ (Enter / rời ô là lưu, Esc hủy). */
export function InlineClassName({ name, markerIndex, onRename }: InlineClassNameProps) {
  const { t } = useTranslation();
  const { isEditing, isSaving, start, triggerRef, inputRef, inputProps } = useInlineEdit({ value: name, onSave: onRename });

  if (!isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate font-semibold">
          <ClassMarker index={markerIndex} className="mr-1.5" />
          {name}
        </p>
        <button
          ref={triggerRef}
          type="button"
          onClick={start}
          aria-label={t('project.class.renameAria', { name })}
          title={t('project.class.rename')}
          className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil />
        </button>
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      {...inputProps}
      aria-label={t('project.class.renameLabel')}
      title={t('project.class.renameHint')}
      maxLength={MAX_NAME_LENGTH}
      aria-busy={isSaving}
      className="min-w-0 flex-1 rounded border border-primary bg-paper px-2 py-1 text-sm font-semibold"
    />
  );
}
