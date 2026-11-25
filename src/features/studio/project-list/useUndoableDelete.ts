import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectRecord } from '@/storage/db';

/** Thời gian còn bấm được "Hoàn tác" trước khi dự án bị xóa thật. */
export const UNDO_DELETE_MS = 6000;

interface UndoableDeleteOptions {
  /** Xóa thật khỏi bộ nhớ trình duyệt. */
  readonly remove: (id: string) => Promise<void>;
  /** Gọi sau khi xóa thật xong (dù thành công hay lỗi), để tải lại danh sách. */
  readonly onSettled: () => void | Promise<void>;
  readonly onError: (project: ProjectRecord, error: unknown) => void;
}

export interface UndoableDelete {
  /** Dự án đang chờ xóa (đã ẩn khỏi danh sách, còn hoàn tác được). */
  readonly pending: ProjectRecord | null;
  readonly request: (project: ProjectRecord) => void;
  readonly undo: () => void;
  /** Xóa ngay, không chờ hết thời gian. */
  readonly confirm: () => void;
}

interface Pending {
  readonly project: ProjectRecord;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Xóa một chạm kèm "Hoàn tác": dự án ẩn ngay, chỉ bị xóa thật khi hết thời gian, khi xóa dự án khác,
 * khi rời trang hoặc khi đóng trang. Mỗi lúc chỉ một dự án chờ xóa.
 */
export function useUndoableDelete({ remove, onSettled, onError }: UndoableDeleteOptions): UndoableDelete {
  const [pending, setPending] = useState<ProjectRecord | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const isMounted = useRef(true);
  const callbacks = useRef({ remove, onSettled, onError });
  useEffect(() => {
    callbacks.current = { remove, onSettled, onError };
  });

  const commit = useCallback(async (entry: Pending) => {
    clearTimeout(entry.timer);
    if (pendingRef.current === entry) {
      pendingRef.current = null;
      if (isMounted.current) setPending(null);
    }
    const { remove: removeNow, onSettled: settle, onError: report } = callbacks.current;
    try {
      await removeNow(entry.project.id);
    } catch (error: unknown) {
      if (isMounted.current) report(entry.project, error);
    }
    if (isMounted.current) await settle();
  }, []);

  const request = useCallback(
    (project: ProjectRecord) => {
      const previous = pendingRef.current;
      if (previous) void commit(previous);
      const entry: Pending = { project, timer: setTimeout(() => void commit(entry), UNDO_DELETE_MS) };
      pendingRef.current = entry;
      setPending(project);
    },
    [commit],
  );

  const undo = useCallback(() => {
    const entry = pendingRef.current;
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback(() => {
    const entry = pendingRef.current;
    if (entry) void commit(entry);
  }, [commit]);

  // Rời trang hoặc đóng tab: người dùng đã chọn xóa, nên xóa thật thay vì để dự án sống lại.
  useEffect(() => {
    isMounted.current = true;
    const flush = () => {
      const entry = pendingRef.current;
      if (entry) void commit(entry);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      isMounted.current = false;
      flush();
    };
  }, [commit]);

  return { pending, request, undo, confirm };
}
