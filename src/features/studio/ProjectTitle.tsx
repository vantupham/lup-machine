import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInlineEdit } from '@/features/studio/useInlineEdit';
import { useProjectRepository } from '@/storage/repository-context';
import { projectNameSchema } from '@/storage/schemas/project';
import { getErrorMessage } from '@/ui/error-message';
import { Pencil } from '@/ui/icons';

interface ProjectTitleProps {
  readonly projectId: string;
  readonly name: string;
  /** Báo cho trang cha khi tên đổi (để tên tệp xuất, thẻ mô hình… dùng tên mới). */
  readonly onRenamed?: (name: string) => void;
}

/**
 * Tiêu đề trang dự án kèm nút "Đổi tên": dự án tạo một chạm có tên tự đặt, sửa lại ngay tại đây.
 * Enter hoặc rời ô là tự lưu, Esc hủy; để trống thì giữ tên cũ.
 */
export function ProjectTitle({ projectId, name, onRenamed }: ProjectTitleProps) {
  const { t } = useTranslation();
  const projects = useProjectRepository();
  /** Tên vừa lưu, dùng trong lúc trang cha còn đang nạp lại và vẫn đưa tên cũ xuống. */
  const [justSaved, setJustSaved] = useState<{ readonly from: string; readonly to: string } | null>(null);
  const shownName = justSaved && justSaved.from === name ? justSaved.to : name;
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string): Promise<boolean> => {
    const parsed = projectNameSchema.safeParse(next);
    if (!parsed.success) {
      setError(t('project.rename.invalid'));
      return false;
    }
    try {
      const updated = await projects.update(projectId, { name: parsed.data });
      setJustSaved({ from: name, to: updated.name });
      setError(null);
      onRenamed?.(updated.name);
      return true;
    } catch (err: unknown) {
      console.error('Không đổi được tên dự án', err);
      setError(t('project.rename.error', { message: getErrorMessage(err) }));
      return false;
    }
  };

  const { isEditing, isSaving, start, triggerRef, inputRef, inputProps } = useInlineEdit({ value: shownName, onSave: save });

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-4xl font-bold">{shownName}</h1>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setError(null);
            start();
          }}
          aria-label={t('project.rename.aria')}
          className="rounded px-2 py-1 text-sm text-muted transition-colors hover:text-primary print:hidden presentation:hidden"
        >
          <Pencil /> {t('project.rename.button')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h1 className="sr-only">{shownName}</h1>
      <input
        ref={inputRef}
        {...inputProps}
        aria-label={t('project.rename.inputLabel')}
        title={t('project.rename.hint')}
        maxLength={100}
        aria-busy={isSaving}
        aria-invalid={error !== null}
        aria-describedby={error ? 'rename-error' : undefined}
        className="w-full min-w-0 rounded border border-primary bg-surface px-3 py-1 font-display text-3xl font-bold sm:max-w-xl"
      />
      {error && (
        <p id="rename-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
