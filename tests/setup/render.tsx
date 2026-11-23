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
import {
  createDexieTableRepository,
  type TableRepository,
} from '@/storage/repositories/table-repository';
import { createDexieAudioRepository, type AudioRepository } from '@/storage/repositories/audio-repository';
import { createDexiePoseRepository, type PoseRepository } from '@/storage/repositories/pose-repository';
import { createDexieProjectFileRepository, type ProjectFileRepository } from '@/storage/repositories/project-file-repository';
import { LupDatabase } from '@/storage/db';
import '@/i18n';

export interface TestRepositories {
  readonly db: LupDatabase;
  readonly repository: ProjectRepository;
  readonly dataset: DatasetRepository;
  readonly experiments: ExperimentRepository;
  readonly tables: TableRepository;
  readonly audio: AudioRepository;
  readonly poses: PoseRepository;
  readonly projectFiles: ProjectFileRepository;
}

export function createTestRepository(): TestRepositories {
  const db = new LupDatabase(`ui-test-${crypto.randomUUID()}`);
  return {
    db,
    repository: createDexieProjectRepository(db),
    dataset: createDexieDatasetRepository(db),
    experiments: createDexieExperimentRepository(db),
    tables: createDexieTableRepository(db),
    audio: createDexieAudioRepository(db),
    poses: createDexiePoseRepository(db),
    projectFiles: createDexieProjectFileRepository(db),
  };
}

export function renderApp(
  route: string,
  repository: ProjectRepository,
  dataset: DatasetRepository = createTestRepository().dataset,
  experiments: ExperimentRepository = createTestRepository().experiments,
  tables: TableRepository = createTestRepository().tables,
  audio: AudioRepository = createTestRepository().audio,
  poses: PoseRepository = createTestRepository().poses,
  projectFiles: ProjectFileRepository = createTestRepository().projectFiles,
): RenderResult {
  return render(
    <RepositoriesProvider repositories={{ projects: repository, dataset, experiments, tables, audio, poses, projectFiles }}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </RepositoriesProvider>,
  );
}
