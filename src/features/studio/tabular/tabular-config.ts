/** Cấu hình mặc định và các phép đổi cấu hình (luôn trả về đối tượng mới). */
import { suggestTask, type ColumnSummary, type TaskKind } from '@/core/tabular/columns';
import { defaultModelFor, isModelForTask } from '@/core/tabular/models';
import type { TabularConfig } from '@/storage/schemas/tabular';

export const DEFAULT_TEST_RATIO = 0.2;
export const DEFAULT_SEED = 1;

export function configForTarget(columns: readonly ColumnSummary[], target: string, base?: TabularConfig): TabularConfig | null {
  const column = columns.find((c) => c.name === target);
  if (!column) return null;
  const task = suggestTask(column);
  return {
    target,
    features: columns.filter((c) => c.name !== target).map((c) => c.name),
    task,
    testRatio: base?.testRatio ?? DEFAULT_TEST_RATIO,
    seed: base?.seed ?? DEFAULT_SEED,
    model: base && isModelForTask(base.model.kind, task) ? base.model : defaultModelFor(task),
  };
}

export function initialConfig(columns: readonly ColumnSummary[], preferredTarget: string | null): TabularConfig | null {
  const target = columns.find((c) => c.name === preferredTarget)?.name ?? columns.at(-1)?.name;
  return target ? configForTarget(columns, target) : null;
}

export function withTask(config: TabularConfig, task: TaskKind): TabularConfig {
  return { ...config, task, model: isModelForTask(config.model.kind, task) ? config.model : defaultModelFor(task) };
}

export function toggleFeature(config: TabularConfig, name: string): TabularConfig {
  const features = config.features.includes(name) ? config.features.filter((f) => f !== name) : [...config.features, name];
  return { ...config, features };
}

/** Cấu hình đã lưu còn khớp với bảng hiện tại không (các cột vẫn tồn tại)? */
export function isConfigValid(config: TabularConfig, columns: readonly ColumnSummary[]): boolean {
  const names = new Set(columns.map((c) => c.name));
  return names.has(config.target) && config.features.every((f) => names.has(f));
}
