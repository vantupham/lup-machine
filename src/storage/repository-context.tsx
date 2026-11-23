import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectRepository } from './repositories/project-repository';
import type { DatasetRepository } from './repositories/dataset-repository';
import type { ExperimentRepository } from './repositories/experiment-repository';
import type { TableRepository } from './repositories/table-repository';
import type { AudioRepository } from './repositories/audio-repository';
import type { PoseRepository } from './repositories/pose-repository';

export interface Repositories {
  readonly projects: ProjectRepository;
  readonly dataset: DatasetRepository;
  readonly experiments: ExperimentRepository;
  readonly tables: TableRepository;
  readonly audio: AudioRepository;
  readonly poses: PoseRepository;
}

const RepositoriesContext = createContext<Repositories | null>(null);

interface ProviderProps {
  readonly repositories: Repositories;
  readonly children: ReactNode;
}

export function RepositoriesProvider({ repositories, children }: ProviderProps) {
  return <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>;
}

function useRepositories(): Repositories {
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
