import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectRecord } from '@/storage/db';
import { useDatasetRepository, useProjectRepository } from '@/storage/repository-context';
import type { ProjectType } from '@/storage/schemas/project';
import { nextProjectName } from './quick-start';

export type CreateProject = (projectType: ProjectType, name?: string) => Promise<ProjectRecord>;

/**
 * Tạo dự án mới; để trống tên thì tự đặt "Dự án ảnh 1"…
 * Chỉ dự án ảnh có sẵn 2 lớp: Âm thanh và Tư thế cần màn hình trống để gợi ý dùng dữ liệu mẫu,
 * Văn bản tự có 2 nhóm trong ô soạn câu, Bảng số lấy nhãn từ cột của bảng.
 */
export function useCreateProject(): CreateProject {
  const { t } = useTranslation();
  const projects = useProjectRepository();
  const dataset = useDatasetRepository();

  return useCallback(
    async (projectType, name) => {
      const trimmed = name?.trim() ?? '';
      const finalName = trimmed || nextProjectName(t(`quickStart.nameBase.${projectType}`), (await projects.findAll()).map((p) => p.name));
      const project = await projects.create({ name: finalName, projectType });
      if (projectType !== 'image') return project;
      try {
        await dataset.addClass(project.id, t('project.defaultClass', { n: 1 }));
        await dataset.addClass(project.id, t('project.defaultClass', { n: 2 }));
        return project;
      } catch (error: unknown) {
        // Không để lại dự án dở dang: bấm lại sẽ tạo dự án mới, nên dự án lỗi phải biến mất.
        await projects.delete(project.id).catch((cleanupError: unknown) => console.error('Không dọn được dự án lỗi', cleanupError));
        throw error;
      }
    },
    [t, projects, dataset],
  );
}
