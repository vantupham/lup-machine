import type { ProjectRecord } from '@/storage/db';
import type { Repositories } from '@/storage/repository-context';
import type { ProjectType } from '@/storage/schemas/project';
import { parseCsv } from '@/core/tabular/csv';
import { datasetFingerprint } from '@/core/data/fingerprint';

/** Số liệu đọc thẳng từ dự án (chính xác, không phải học sinh tự ghi). */
export interface ModelCardFacts {
  readonly projectType: ProjectType;
  readonly classes: readonly ClassFact[];
  readonly table: { readonly rows: number; readonly columns: number } | null;
  readonly latestRun: RunFact | null;
}

export interface ClassFact {
  readonly name: string;
  readonly count: number;
  /** Chỉ dự án ảnh chia sẵn ngăn Huấn luyện / Kiểm tra. */
  readonly train: number | null;
  readonly test: number | null;
}

export interface RunFact {
  readonly number: number;
  readonly epochs: number;
  readonly trainAccuracy: number;
  readonly testAccuracy: number | null;
  /** false: dữ liệu đã đổi (thêm / xóa ảnh, đổi ngăn) sau lần chạy này, số liệu không còn đúng với dữ liệu hiện tại. */
  readonly matchesData: boolean;
}

export type FactsRepositories = Pick<Repositories, 'dataset' | 'audio' | 'poses' | 'tables' | 'experiments'>;

function countByClass(classIds: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of classIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

async function classFacts(repos: FactsRepositories, project: ProjectRecord): Promise<ClassFact[]> {
  const classes = await repos.dataset.listClasses(project.id);
  if (project.projectType === 'image') {
    const counts = await repos.dataset.countSamples(project.id);
    return classes.map((c) => {
      const { train, test } = counts[c.id] ?? { train: 0, test: 0 };
      return { name: c.name, count: train + test, train, test };
    });
  }
  const items = project.projectType === 'audio' ? await repos.audio.listClips(project.id) : await repos.poses.listPoses(project.id);
  const counts = countByClass(items.map((i) => i.classId));
  return classes.map((c) => ({ name: c.name, count: counts.get(c.id) ?? 0, train: null, test: null }));
}

async function tableFact(repos: FactsRepositories, projectId: string): Promise<ModelCardFacts['table']> {
  const stored = await repos.tables.get(projectId);
  if (!stored) return null;
  const parsed = parseCsv(stored.csv);
  return parsed.ok ? { rows: parsed.table.rows.length, columns: parsed.table.headers.length } : null;
}

async function latestRun(repos: FactsRepositories, projectId: string): Promise<RunFact | null> {
  const [run] = await repos.experiments.listRuns(projectId);
  const last = run?.metrics.at(-1);
  if (!run || !last) return null;
  const [classes, samples] = await Promise.all([repos.dataset.listClasses(projectId), repos.dataset.listSamples(projectId)]);
  const fingerprint = datasetFingerprint(classes.map((c) => c.id), samples);
  return {
    number: run.number,
    epochs: run.options.epochs,
    trainAccuracy: last.trainAccuracy,
    testAccuracy: last.testAccuracy,
    matchesData: run.fingerprint === fingerprint,
  };
}

export async function loadModelCardFacts(repos: FactsRepositories, project: ProjectRecord): Promise<ModelCardFacts> {
  const type = project.projectType;
  const hasClasses = type === 'image' || type === 'audio' || type === 'pose';
  return {
    projectType: type,
    classes: hasClasses ? await classFacts(repos, project) : [],
    table: type === 'text' || type === 'tabular' ? await tableFact(repos, project.id) : null,
    latestRun: type === 'image' ? await latestRun(repos, project.id) : null,
  };
}
