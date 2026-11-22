import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/app/AppRoutes';
import { ProjectRepositoryProvider } from '@/storage/repository-context';
import type { ProjectRepository } from '@/storage/repositories/project-repository';
import { createDexieProjectRepository } from '@/storage/repositories/project-repository';
import { LupDatabase } from '@/storage/db';
import '@/i18n';

export function createTestRepository(): { repository: ProjectRepository; db: LupDatabase } {
  const db = new LupDatabase(`ui-test-${crypto.randomUUID()}`);
  return { db, repository: createDexieProjectRepository(db) };
}

export function renderApp(route: string, repository: ProjectRepository): RenderResult {
  return render(
    <ProjectRepositoryProvider repository={repository}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </ProjectRepositoryProvider>,
  );
}
