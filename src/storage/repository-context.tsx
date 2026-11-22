import { createContext, useContext, type ReactNode } from 'react';
import type { ProjectRepository } from './repositories/project-repository';

const ProjectRepositoryContext = createContext<ProjectRepository | null>(null);

interface ProviderProps {
  readonly repository: ProjectRepository;
  readonly children: ReactNode;
}

export function ProjectRepositoryProvider({ repository, children }: ProviderProps) {
  return (
    <ProjectRepositoryContext.Provider value={repository}>{children}</ProjectRepositoryContext.Provider>
  );
}

export function useProjectRepository(): ProjectRepository {
  const repository = useContext(ProjectRepositoryContext);
  if (!repository) throw new Error('useProjectRepository phải nằm trong ProjectRepositoryProvider');
  return repository;
}
