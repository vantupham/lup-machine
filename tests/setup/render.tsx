import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/app/AppRoutes';
import { RepositoriesProvider } from '@/storage/repository-context';
import {
  createDexieProjectRepository,
  type ProjectRepository,
} from '@/storage/repositories/project-repository';
import {
  createDexieDatasetRepository,
  type DatasetRepository,
} from '@/storage/repositories/dataset-repository';
import {
  createDexieExperimentRepository,
  type ExperimentRepository,
} from '@/storage/repositories/experiment-repository';
import { LupDatabase } from '@/storage/db';
import '@/i18n';

export interface TestRepositories {
  readonly db: LupDatabase;
  readonly repository: ProjectRepository;
  readonly dataset: DatasetRepository;
  readonly experiments: ExperimentRepository;
}

export function createTestRepository(): TestRepositories {
  const db = new LupDatabase(`ui-test-${crypto.randomUUID()}`);
  return {
    db,
    repository: createDexieProjectRepository(db),
    dataset: createDexieDatasetRepository(db),
    experiments: createDexieExperimentRepository(db),
  };
}

export function renderApp(
  route: string,
  repository: ProjectRepository,
  dataset: DatasetRepository = createTestRepository().dataset,
  experiments: ExperimentRepository = createTestRepository().experiments,
): RenderResult {
  return render(
    <RepositoriesProvider repositories={{ projects: repository, dataset, experiments }}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </RepositoriesProvider>,
  );
}
