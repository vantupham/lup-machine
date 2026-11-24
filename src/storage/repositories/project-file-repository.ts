import { version as APP_VERSION } from '../../../package.json';
import { datasetFingerprint } from '@/core/data/fingerprint';
import { fileSlug } from '@/core/file-name';
import type { AudioClipRecord, ClassRecord, LupDatabase, PoseSampleRecord, ProjectRecord, RunRecord, SampleRecord, TableRecord } from '../db';
import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';
import type { BundleRun, ProjectBundle } from '../project-file/bundle';
import { PROJECT_FILE_EXTENSION, ProjectFileError } from '../project-file/constants';
import { createDexieDatasetRepository } from './dataset-repository';
import { createDexieAudioRepository } from './audio-repository';
import { createDexiePoseRepository } from './pose-repository';
import { createDexieTableRepository } from './table-repository';
import { createDexieExperimentRepository } from './experiment-repository';
import { createDexieModelCardRepository } from './model-card-repository';
import { pickModelCardFields } from '../schemas/model-card';
import type { RepositoryDeps } from './project-repository';

export interface ExportedProjectFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Xuất / nhập cả một dự án thành một tệp .lup (zip). Không có máy chủ: tệp nằm trên máy người dùng. */
export interface ProjectFileRepository {
  exportProject(projectId: string): Promise<ExportedProjectFile>;
  /** Nhập thành một dự án MỚI (id mới), không ghi đè dự án đang có. */
  importProject(bytes: Uint8Array): Promise<ProjectRecord>;
}

const defaultDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

export function projectFileName(projectName: string): string {
  return `${fileSlug(projectName)}${PROJECT_FILE_EXTENSION}`;
}

export function createDexieProjectFileRepository(db: LupDatabase, deps: RepositoryDeps = defaultDeps): ProjectFileRepository {
  const dataset = createDexieDatasetRepository(db);
  const audio = createDexieAudioRepository(db);
  const poses = createDexiePoseRepository(db);
  const tables = createDexieTableRepository(db);
  const experiments = createDexieExperimentRepository(db);
  const modelCards = createDexieModelCardRepository(db);

  const readBundle = async (project: ProjectRecord): Promise<ProjectBundle> => {
    const classes = await dataset.listClasses(project.id);
    const classIndex = new Map(classes.map((c, i) => [c.id, i]));
    const indexOf = (classId: string) => {
      const index = classIndex.get(classId);
      if (index === undefined) throw new Error(`Mẫu thuộc lớp không tồn tại: ${classId}`);
      return index;
    };
    const samples = await dataset.listSamples(project.id);
    const fingerprint = datasetFingerprint(classes.map((c) => c.id), samples);
    const table = await tables.get(project.id);
    const card = await modelCards.get(project.id);
    return {
      manifest: {
        formatVersion: CURRENT_FORMAT_VERSION,
        appVersion: APP_VERSION,
        projectType: project.projectType,
        name: project.name,
        createdAt: project.createdAt,
      },
      classes: classes.map((c) => c.name),
      images: samples.map((s) => ({
        classIndex: indexOf(s.classId),
        split: s.split,
        source: s.source,
        image: s.image,
        ...(s.credit ? { credit: s.credit } : {}),
      })),
      clips: (await audio.listClips(project.id)).map((c) => ({ classIndex: indexOf(c.classId), source: c.source, samples: new Float32Array(c.pcm) })),
      poses: (await poses.listPoses(project.id)).map((p) => ({
        classIndex: indexOf(p.classId),
        kind: p.kind,
        source: p.source,
        keypoints: p.keypoints,
        width: p.width,
        height: p.height,
      })),
      table: table ? { csv: table.csv, fileName: table.fileName, sampleId: table.sampleId, config: table.config } : null,
      runs: (await experiments.listRuns(project.id))
        .slice()
        .reverse()
        .map((run): BundleRun => ({
          number: run.number,
          createdAt: run.createdAt,
          fingerprint: run.fingerprint,
          options: run.options,
          classNames: run.classNames,
          counts: run.counts,
          metrics: run.metrics,
          matchesData: run.fingerprint === fingerprint,
        })),
      modelCard: card ? pickModelCardFields(card) : null,
    };
  };

  const writeBundle = async (bundle: ProjectBundle): Promise<ProjectRecord> => {
    const timestamp = deps.now();
    const project: ProjectRecord = {
      id: deps.newId(),
      name: bundle.manifest.name,
      projectType: bundle.manifest.projectType,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const classes = bundle.classes.map((name, order): ClassRecord => ({ id: deps.newId(), projectId: project.id, name, order, createdAt: timestamp }));
    const classId = (index: number) => {
      const record = classes[index];
      if (!record) throw new Error(`Không có lớp số ${index + 1}`);
      return record.id;
    };
    const samples = bundle.images.map((item, seq): SampleRecord => ({
      id: deps.newId(),
      projectId: project.id,
      classId: classId(item.classIndex),
      split: item.split,
      source: item.source,
      image: item.image,
      createdAt: timestamp,
      seq,
      ...(item.credit ? { credit: item.credit } : {}),
    }));
    const clips = bundle.clips.map((clip, seq): AudioClipRecord => ({
      id: deps.newId(),
      projectId: project.id,
      classId: classId(clip.classIndex),
      source: clip.source,
      pcm: clip.samples.slice().buffer,
      createdAt: timestamp,
      seq,
    }));
    const poseRecords = bundle.poses.map((pose, seq): PoseSampleRecord => ({
      id: deps.newId(),
      projectId: project.id,
      classId: classId(pose.classIndex),
      kind: pose.kind,
      source: pose.source,
      keypoints: [...pose.keypoints],
      width: pose.width,
      height: pose.height,
      createdAt: timestamp,
      seq,
    }));
    // Dấu vân tay dựa trên id mẫu (đã đổi) → tính lại cho các lần chạy dùng đúng dữ liệu đang nhập.
    const newFingerprint = datasetFingerprint(classes.map((c) => c.id), samples);
    const runs = bundle.runs.map(({ matchesData, ...run }): RunRecord => ({
      ...run,
      id: deps.newId(),
      projectId: project.id,
      fingerprint: matchesData ? newFingerprint : run.fingerprint,
    }));
    const table: TableRecord | null = bundle.table ? { projectId: project.id, ...bundle.table, updatedAt: timestamp } : null;

    await db.transaction('rw', [db.projects, db.classes, db.samples, db.audioClips, db.poseSamples, db.dataTables, db.runs, db.modelCards], async () => {
      await db.projects.add(project);
      await db.classes.bulkAdd(classes);
      await db.samples.bulkAdd(samples);
      await db.audioClips.bulkAdd(clips);
      await db.poseSamples.bulkAdd(poseRecords);
      await db.runs.bulkAdd(runs);
      if (table) await db.dataTables.add(table);
      if (bundle.modelCard) await db.modelCards.add({ projectId: project.id, fields: bundle.modelCard, updatedAt: timestamp });
    });
    return project;
  };

  return {
    async exportProject(projectId) {
      const project = await db.projects.get(projectId);
      if (!project) throw new Error(`Không tìm thấy dự án: ${projectId}`);
      const bundle = await readBundle(project);
      // Thư viện zip chỉ tải khi cần (không làm nặng lần mở trang đầu tiên).
      const { encodeBundle } = await import('../project-file/bundle');
      return { fileName: projectFileName(project.name), bytes: encodeBundle(bundle) };
    },

    async importProject(bytes) {
      const { decodeBundle } = await import('../project-file/bundle');
      return writeBundle(decodeBundle(bytes));
    },
  };
}

export { ProjectFileError };
