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
import { createDexieModelCardRepository, type ModelCardRepository } from '@/storage/repositories/model-card-repository';
import { createDexieAssignmentRepository, type AssignmentRepository } from '@/storage/repositories/assignment-repository';
import { createDexieSubmissionRepository, type SubmissionRepository } from '@/storage/repositories/submission-repository';
import { createDexieNotebookRepository, type NotebookRepository } from '@/storage/repositories/notebook-repository';
import { createDexieTrialRepository, type TrialRepository } from '@/storage/repositories/trial-repository';
import { createDexieLectureVoiceRepository, type LectureVoiceRepository } from '@/storage/repositories/lecture-voice-repository';
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
  readonly modelCards: ModelCardRepository;
  readonly assignments: AssignmentRepository;
  readonly submissions: SubmissionRepository;
  readonly notebook: NotebookRepository;
  readonly trials: TrialRepository;
  readonly lectureVoices: LectureVoiceRepository;
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
    modelCards: createDexieModelCardRepository(db),
    assignments: createDexieAssignmentRepository(db),
    submissions: createDexieSubmissionRepository(db),
    notebook: createDexieNotebookRepository(db),
    trials: createDexieTrialRepository(db),
    lectureVoices: createDexieLectureVoiceRepository(db),
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
  modelCards: ModelCardRepository = createTestRepository().modelCards,
  assignments: AssignmentRepository = createTestRepository().assignments,
  submissions: SubmissionRepository = createTestRepository().submissions,
  notebook: NotebookRepository = createTestRepository().notebook,
  trials: TrialRepository = createTestRepository().trials,
  lectureVoices: LectureVoiceRepository = createTestRepository().lectureVoices,
): RenderResult {
  return render(
    <RepositoriesProvider repositories={{ projects: repository, dataset, experiments, tables, audio, poses, projectFiles, modelCards, assignments, submissions, notebook, trials, lectureVoices }}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </RepositoriesProvider>,
  );
}

/** Mở ứng dụng với toàn bộ repository dùng chung một cơ sở dữ liệu thử. */
export function renderWithRepositories(route: string, r: TestRepositories): RenderResult {
  return renderApp(route, r.repository, r.dataset, r.experiments, r.tables, r.audio, r.poses, r.projectFiles, r.modelCards, r.assignments, r.submissions, r.notebook, r.trials, r.lectureVoices);
}
