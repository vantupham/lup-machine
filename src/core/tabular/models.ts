/**
 * Huấn luyện / dự đoán / đánh giá các mô hình cho dữ liệu bảng.
 * - Hồi quy logistic và k-NN dùng dữ liệu ĐÃ CHUẨN HÓA (để các cột cùng thang đo).
 * - Cây quyết định và hồi quy tuyến tính dùng dữ liệu GỐC (ngưỡng và hệ số đọc được theo đơn vị thật).
 */
import { fitTree, featureImportances, predictTree, type DecisionTree } from '@/core/algorithms/decision-tree';
import { knnClassify, knnRegress, type KnnNeighbor } from '@/core/algorithms/knn';
import { fitLinearRegression, meanSquaredError, predictLinear, r2Score, type LinearModel } from '@/core/algorithms/linear-regression';
import { fitLogisticRegression, logisticScores, predictLogisticProba, type LogisticModel } from '@/core/algorithms/logistic-regression';
import { accuracy, confusionMatrix } from '@/core/ml/metrics';
import type { TabularModelKind, TabularModelSettings } from '@/storage/schemas/tabular';
import type { TaskKind } from './columns';
import type { EncodedSplit, PreparedData } from './prepare';

export const MODELS_BY_TASK: Readonly<Record<TaskKind, readonly TabularModelKind[]>> = {
  classification: ['tree', 'logistic', 'knn'],
  regression: ['linear', 'knn-regression'],
};

export const DEFAULT_MODEL_SETTINGS: Omit<TabularModelSettings, 'kind'> = { c: 1, maxDepth: 3, criterion: 'gini', k: 5 };

export function defaultModelFor(task: TaskKind): TabularModelSettings {
  return { kind: MODELS_BY_TASK[task][0] as TabularModelKind, ...DEFAULT_MODEL_SETTINGS };
}

export type TrainedModel =
  | { readonly kind: 'tree'; readonly tree: DecisionTree }
  | { readonly kind: 'logistic'; readonly model: LogisticModel }
  | { readonly kind: 'knn'; readonly k: number; readonly train: EncodedSplit; readonly numClasses: number }
  | { readonly kind: 'linear'; readonly model: LinearModel }
  | { readonly kind: 'knn-regression'; readonly k: number; readonly train: EncodedSplit };

export interface EncodedRow {
  readonly raw: readonly number[];
  readonly scaled: readonly number[];
}

export interface RowPrediction {
  /** Phân loại: chỉ số lớp. Hồi quy: giá trị dự đoán. */
  readonly value: number;
  /** Chỉ có ở phân loại. */
  readonly proba: readonly number[] | null;
  /** k-NN: các láng giềng (chỉ số dòng trong tập Dạy). */
  readonly neighbors: readonly KnnNeighbor[] | null;
  /** Cây quyết định: các nút đi qua. */
  readonly path: readonly number[] | null;
}

export function isModelForTask(kind: TabularModelKind, task: TaskKind): boolean {
  return MODELS_BY_TASK[task].includes(kind);
}

export function trainTabular(data: PreparedData, settings: TabularModelSettings): TrainedModel {
  if (!isModelForTask(settings.kind, data.task)) throw new RangeError(`Mô hình ${settings.kind} không dùng cho bài toán ${data.task}`);
  const numClasses = data.classNames.length;
  switch (settings.kind) {
    case 'tree':
      return { kind: 'tree', tree: fitTree(data.train.raw, data.train.y, numClasses, { criterion: settings.criterion, maxDepth: settings.maxDepth }) };
    case 'logistic':
      return { kind: 'logistic', model: fitLogisticRegression(data.train.scaled, data.train.y, numClasses, { c: settings.c }) };
    case 'knn':
      return { kind: 'knn', k: settings.k, train: data.train, numClasses };
    case 'linear':
      return { kind: 'linear', model: fitLinearRegression(data.train.raw, data.train.y) };
    case 'knn-regression':
      return { kind: 'knn-regression', k: settings.k, train: data.train };
  }
}

export function predictRow(trained: TrainedModel, row: EncodedRow): RowPrediction {
  switch (trained.kind) {
    case 'tree': {
      const p = predictTree(trained.tree, row.raw);
      return { value: p.label, proba: p.proba, neighbors: null, path: p.path };
    }
    case 'logistic': {
      const proba = predictLogisticProba(trained.model, row.scaled);
      return { value: proba.indexOf(Math.max(...proba)), proba, neighbors: null, path: null };
    }
    case 'knn': {
      const r = knnClassify(trained.train.scaled, trained.train.y, trained.numClasses, row.scaled, trained.k);
      return { value: r.label, proba: r.votes.map((v) => v / r.neighbors.length), neighbors: r.neighbors, path: null };
    }
    case 'linear':
      return { value: predictLinear(trained.model, row.raw), proba: null, neighbors: null, path: null };
    case 'knn-regression': {
      const r = knnRegress(trained.train.scaled, trained.train.y, row.scaled, trained.k);
      return { value: r.value, proba: null, neighbors: r.neighbors, path: null };
    }
  }
}

function predictSplit(trained: TrainedModel, split: EncodedSplit): number[] {
  return split.raw.map((raw, i) => predictRow(trained, { raw, scaled: split.scaled[i] as number[] }).value);
}

export interface ClassificationScore {
  readonly accuracy: number | null;
  readonly confusion: number[][];
}

export interface RegressionScore {
  readonly mse: number | null;
  readonly r2: number | null;
}

export type Evaluation =
  | {
      readonly task: 'classification';
      readonly train: ClassificationScore;
      readonly test: ClassificationScore;
      readonly testPredictions: number[];
    }
  | {
      readonly task: 'regression';
      readonly train: RegressionScore;
      readonly test: RegressionScore;
      readonly testPredictions: number[];
    };

export function evaluateTabular(trained: TrainedModel, data: PreparedData): Evaluation {
  const trainPred = predictSplit(trained, data.train);
  const testPred = predictSplit(trained, data.test);
  if (data.task === 'classification') {
    const k = data.classNames.length;
    return {
      task: 'classification',
      train: { accuracy: accuracy(data.train.y, trainPred), confusion: confusionMatrix(data.train.y, trainPred, k) },
      test: { accuracy: accuracy(data.test.y, testPred), confusion: confusionMatrix(data.test.y, testPred, k) },
      testPredictions: testPred,
    };
  }
  const score = (y: readonly number[], pred: readonly number[]): RegressionScore =>
    y.length === 0 ? { mse: null, r2: null } : { mse: meanSquaredError(y, pred), r2: r2Score(y, pred) };
  return { task: 'regression', train: score(data.train.y, trainPred), test: score(data.test.y, testPred), testPredictions: testPred };
}

/** Đóng góp của từng đặc trưng vào điểm (logit) hoặc giá trị dự đoán: trọng số × giá trị. */
export function contributions(trained: TrainedModel, row: EncodedRow): number[][] | null {
  if (trained.kind === 'logistic') {
    return trained.model.weights.map((w) => w.map((wj, j) => wj * (row.scaled[j] as number)));
  }
  if (trained.kind === 'linear') {
    return [trained.model.weights.map((wj, j) => wj * (row.raw[j] as number))];
  }
  return null;
}

export function logisticRowScores(trained: TrainedModel, row: EncodedRow): number[] | null {
  return trained.kind === 'logistic' ? logisticScores(trained.model, row.scaled) : null;
}

export function treeImportances(trained: TrainedModel): number[] | null {
  return trained.kind === 'tree' ? featureImportances(trained.tree) : null;
}
