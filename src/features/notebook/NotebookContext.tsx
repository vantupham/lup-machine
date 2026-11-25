import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ProjectType } from '@/storage/schemas/project';
import type { NotebookRepository } from '@/storage/repositories/notebook-repository';
import { useNotebookRepository } from '@/storage/repository-context';

export type NotebookStatus = 'loading' | 'ready' | 'error';

export interface NotebookContextValue {
  readonly projectId: string;
  readonly projectType: ProjectType;
  readonly repository: NotebookRepository;
  readonly status: NotebookStatus;
  /** Nội dung mới nhất của một bước (kể cả phần đang gõ chưa kịp lưu). */
  readonly textOf: (step: string) => string;
  readonly remember: (step: string, text: string) => void;
}

const NotebookContext = createContext<NotebookContextValue | null>(null);

interface NotebookProviderProps {
  readonly projectId: string;
  readonly projectType: ProjectType;
  readonly children: ReactNode;
}

/** Đọc sổ tay của dự án một lần cho mọi bước trên trang. */
export function NotebookProvider({ projectId, projectType, children }: NotebookProviderProps) {
  const repository = useNotebookRepository();
  /** Trạng thái đọc gắn với dự án đã đọc: đổi sang dự án khác thì tự về "loading". */
  const [loaded, setLoaded] = useState<{ readonly projectId: string; readonly status: NotebookStatus } | null>(null);
  const status: NotebookStatus = loaded?.projectId === projectId ? loaded.status : 'loading';
  const notes = useRef(new Map<string, string>());

  useEffect(() => {
    let isActive = true;
    repository.list(projectId).then(
      (list) => {
        if (!isActive) return;
        notes.current = new Map(list.map((n) => [n.step, n.text]));
        setLoaded({ projectId, status: 'ready' });
      },
      (error: unknown) => {
        console.error('Không đọc được sổ tay của dự án', projectId, error);
        if (isActive) setLoaded({ projectId, status: 'error' });
      },
    );
    return () => {
      isActive = false;
    };
  }, [repository, projectId]);

  const value = useMemo<NotebookContextValue>(
    () => ({
      projectId,
      projectType,
      repository,
      status,
      textOf: (step) => notes.current.get(step) ?? '',
      remember: (step, text) => {
        notes.current.set(step, text);
      },
    }),
    [projectId, projectType, repository, status],
  );
  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}

/** null khi không nằm trong một dự án (ví dụ kiểm thử riêng từng phần). */
export function useNotebook(): NotebookContextValue | null {
  return useContext(NotebookContext);
}
