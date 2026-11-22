import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectRepository } from './repositories/project-repository';
import type { DatasetRepository } from './repositories/dataset-repository';
import type { ExperimentRepository } from './repositories/experiment-repository';

export interface Repositories {
  readonly projects: ProjectRepository;
  readonly dataset: DatasetRepository;
  readonly experiments: ExperimentRepository;
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
