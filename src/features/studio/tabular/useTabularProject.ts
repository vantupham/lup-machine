import { useCallback, useEffect, useState } from 'react';
import type { ProjectRecord } from '@/storage/db';
import type { SaveTableInput, StoredTable } from '@/storage/repositories/table-repository';
import { useProjectRepository, useTableRepository } from '@/storage/repository-context';
import type { TableProjectConfig } from '@/storage/repositories/table-repository';

export type TabularProjectState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly project: ProjectRecord; readonly table: StoredTable | null };

/** Tải dự án dữ liệu bảng / văn bản và bảng dữ liệu đã lưu; các hàm lưu cập nhật luôn trạng thái. */
export function useTabularProject(projectId: string) {
  const projects = useProjectRepository();
  const tables = useTableRepository();
  const [state, setState] = useState<TabularProjectState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    void (async (): Promise<TabularProjectState> => {
      try {
        const project = await projects.findById(projectId);
        if (!project) return { status: 'not-found' };
        return { status: 'ready', project, table: await tables.get(projectId) };
      } catch (error: unknown) {
        console.error('Không tải được dự án dữ liệu bảng', error);
        return { status: 'error' };
      }
    })().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, [projects, tables, projectId]);

  const saveTable = useCallback(
    async (input: Omit<SaveTableInput, 'projectId'>) => {
      const table = await tables.saveTable({ ...input, projectId });
      setState((s) => (s.status === 'ready' ? { ...s, table } : s));
    },
    [tables, projectId],
  );

  const saveConfig = useCallback(
    async (config: TableProjectConfig) => {
      setState((s) => (s.status === 'ready' && s.table ? { ...s, table: { ...s.table, config } } : s));
      await tables.saveConfig(projectId, config);
    },
    [tables, projectId],
  );

  return { state, saveTable, saveConfig };
}
