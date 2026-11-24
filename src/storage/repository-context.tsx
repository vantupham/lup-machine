import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectRepository } from './repositories/project-repository';
import type { DatasetRepository } from './repositories/dataset-repository';
import type { ExperimentRepository } from './repositories/experiment-repository';
import type { TableRepository } from './repositories/table-repository';
import type { AudioRepository } from './repositories/audio-repository';
import type { PoseRepository } from './repositories/pose-repository';
import type { ProjectFileRepository } from './repositories/project-file-repository';
import type { ModelCardRepository } from './repositories/model-card-repository';
import type { AssignmentRepository } from './repositories/assignment-repository';
import type { SubmissionRepository } from './repositories/submission-repository';

export interface Repositories {
  readonly projects: ProjectRepository;
  readonly dataset: DatasetRepository;
  readonly experiments: ExperimentRepository;
  readonly tables: TableRepository;
  readonly audio: AudioRepository;
  readonly poses: PoseRepository;
  readonly projectFiles: ProjectFileRepository;
  readonly modelCards: ModelCardRepository;
  readonly assignments: AssignmentRepository;
  readonly submissions: SubmissionRepository;
}

const RepositoriesContext = createContext<Repositories | null>(null);

interface ProviderProps {
  readonly repositories: Repositories;
  readonly children: ReactNode;
}

export function RepositoriesProvider({ repositories, children }: ProviderProps) {
  return <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('Cần đặt trong RepositoriesProvider');
  return repositories;
}

export function useProjectRepository(): ProjectRepository {
  return useRepositories().projects;
}

export function useDatasetRepository(): DatasetRepository {
  return useRepositories().dataset;
}

export function useExperimentRepository(): ExperimentRepository {
  return useRepositories().experiments;
}

export function useTableRepository(): TableRepository {
  return useRepositories().tables;
}

export function useAudioRepository(): AudioRepository {
  return useRepositories().audio;
}

export function usePoseRepository(): PoseRepository {
  return useRepositories().poses;
}

export function useProjectFileRepository(): ProjectFileRepository {
  return useRepositories().projectFiles;
}

export function useModelCardRepository(): ModelCardRepository {
  return useRepositories().modelCards;
}

export function useAssignmentRepository(): AssignmentRepository {
  return useRepositories().assignments;
}

export function useSubmissionRepository(): SubmissionRepository {
  return useRepositories().submissions;
}
