import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectRepository } from '@/storage/repository-context';
import { projectNameSchema } from '@/storage/schemas/project';
import { getErrorMessage } from '@/ui/error-message';

interface ProjectTitleProps {
  readonly projectId: string;
  readonly name: string;
  /** Báo cho trang cha khi tên đổi (để tên tệp xuất, thẻ mô hình… dùng tên mới). */
  readonly onRenamed?: (name: string) => void;
}

/** Tiêu đề trang dự án kèm nút "Đổi tên": dự án tạo một chạm có tên tự đặt, sửa lại ngay tại đây. */
export function ProjectTitle({ projectId, name, onRenamed }: ProjectTitleProps) {
  const { t } = useTranslation();
  const projects = useProjectRepository();
  /** Tên vừa lưu, dùng trong lúc trang cha còn đang nạp lại và vẫn đưa tên cũ xuống. */
  const [justSaved, setJustSaved] = useState<{ readonly from: string; readonly to: string } | null>(null);
  const shownName = justSaved && justSaved.from === name ? justSaved.to : name;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** Chỉ trả con trỏ về nút "Đổi tên" sau khi người dùng vừa sửa xong, không phải lúc trang mới mở. */
  const returnFocus = useRef(false);

  const isEditing = draft !== null;

  // Layout effect: chuyển con trỏ ngay khi ô nhập biến mất, trước khi vẽ, để con trỏ không rơi về <body>.
  useLayoutEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [isEditing]);

  const close = () => {
    returnFocus.current = true;
    setDraft(null);
    setError(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!isEditing) return;
    const parsed = projectNameSchema.safeParse(draft);
    if (!parsed.success) {
      setError(t('project.rename.invalid'));
      return;
    }
    if (parsed.data === shownName) {
      close();
      return;
    }
    setIsSaving(true);
    try {
      const updated = await projects.update(projectId, { name: parsed.data });
      setJustSaved({ from: name, to: updated.name });
      onRenamed?.(updated.name);
      close();
    } catch (err: unknown) {
      console.error('Không đổi được tên dự án', err);
      setError(t('project.rename.error', { message: getErrorMessage(err) }));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-4xl font-bold">{shownName}</h1>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setDraft(shownName)}
          aria-label={t('project.rename.aria')}
          className="rounded px-2 py-1 text-sm text-muted transition-colors hover:text-primary print:hidden presentation:hidden"
        >
          ✎ {t('project.rename.button')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-2" noValidate>
      <h1 className="sr-only">{shownName}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          aria-label={t('project.rename.inputLabel')}
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? 'rename-error' : undefined}
          className="min-w-0 flex-1 rounded border border-primary bg-surface px-3 py-1 font-display text-3xl font-bold sm:max-w-xl"
        />
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {t('project.rename.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={close}>
          {t('project.rename.cancel')}
        </button>
      </div>
      {error && (
        <p id="rename-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
