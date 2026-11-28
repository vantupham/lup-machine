import type { TFunction } from 'i18next';
import { findInsights, type Finding, type ScoredItem } from '@/core/ml/findings';
import { FEATURE_DIM } from '@/core/ml/feature-model';
import { denseParams, MOBILENET_SUMMARY } from '@/core/ml/network-summary';
import type { RunRecord } from '@/storage/db';
import type { ModelCardFields } from '@/storage/schemas/model-card';
import { lectureFormat, type LectureFormat } from './lecture-format';
import type { LectureLevel, LectureScene, LectureScript, NarrationLine, SceneId, SceneVisual } from './lecture-script';

export type LectureRun = Pick<RunRecord, 'number' | 'options' | 'classNames' | 'counts' | 'metrics' | 'guess' | 'conclusion'>;

export interface ImageLectureInput {
  readonly projectName: string;
  readonly classNames: readonly string[];
  /** Số ảnh mỗi lớp, cùng thứ tự với classNames. */
  readonly counts: readonly { readonly train: number; readonly test: number }[];
  /** Nhật ký huấn luyện, lần cuối là mô hình đang giảng. */
  readonly runs: readonly LectureRun[];
  /** Dự đoán của mô hình hiện tại trên tập Kiểm tra (null: chưa có). */
  readonly evaluation: { readonly items: readonly ScoredItem[] } | null;
  /** Kết quả "Soi kỹ" ở bước 2 (null: chưa soi). */
  readonly dataChecks: {
    readonly sameSplitPairs: number;
    readonly leakPairs: number;
    readonly shortcut: { readonly a: string; readonly b: string; readonly accuracy: number } | null;
  } | null;
  readonly modelCard: ModelCardFields | null;
  readonly level: LectureLevel;
  /** Chữ học sinh tự viết (kết luận, thẻ mô hình): mặc định không đưa vào video. */
  readonly includeStudentWriting: boolean;
}

/** Chênh Huấn luyện − Kiểm tra từ mức này trở lên thì nhắc chuyện học thuộc. */
export const OVERFIT_GAP = 0.15;
/** Lớp nhiều ảnh gấp ngần này lần lớp ít nhất thì nhắc mất cân bằng. */
export const IMBALANCE_RATIO = 1.5;

const K = 'lecture.image';

interface Ctx {
  readonly t: TFunction;
  readonly f: LectureFormat;
  readonly input: ImageLectureInput;
  readonly run: LectureRun;
  readonly findings: readonly Finding[];
  readonly matrix: readonly (readonly number[])[];
}

/** Câu có điều kiện: `cond && f.line(...)` cho ra false / '' / undefined khi không đủ điều kiện. */
type MaybeLine = NarrationLine | null | undefined | false | '';

function scene(ctx: Ctx, id: SceneId, lines: readonly MaybeLine[], visual: SceneVisual): LectureScene {
  return { id, title: ctx.t(`${K}.titles.${id}`), lines: lines.filter((l): l is NarrationLine => Boolean(l)), visual };
}

const lastMetrics = (run: LectureRun) => run.metrics.at(-1) ?? null;

function confusionMatrix(items: readonly ScoredItem[], numClasses: number): number[][] {
  const matrix = Array.from({ length: numClasses }, () => new Array<number>(numClasses).fill(0));
  for (const { actual, predicted } of items) {
    const row = matrix[actual];
    if (row && predicted >= 0 && predicted < numClasses) row[predicted] = (row[predicted] ?? 0) + 1;
  }
  return matrix;
}

function titleScene(ctx: Ctx): LectureScene {
  const { f, input } = ctx;
  return scene(
    ctx,
    'title',
    [f.line(`${K}.title.intro`, { name: input.projectName, count: f.count(input.classNames.length), classes: f.list(input.classNames) }), f.line(`${K}.title.goal`)],
    { kind: 'title', projectName: input.projectName, classNames: input.classNames },
  );
}

function dataScene(ctx: Ctx): LectureScene {
  const { f, input } = ctx;
  const classes = input.classNames.map((name, i) => ({ name, train: input.counts[i]?.train ?? 0, test: input.counts[i]?.test ?? 0 }));
  const train = classes.reduce((s, c) => s + c.train, 0);
  const test = classes.reduce((s, c) => s + c.test, 0);
  const sorted = [...classes].sort((a, b) => b.train - a.train);
  const big = sorted[0];
  const small = sorted.at(-1);
  const isImbalanced = big && small && small.train > 0 && big.train / small.train >= IMBALANCE_RATIO;
  return scene(
    ctx,
    'data',
    [
      f.line(`${K}.data.total`, { total: f.count(train + test), train: f.count(train), test: f.count(test) }),
      ...classes.map((c) => f.line(`${K}.data.perClass`, { name: c.name, train: f.count(c.train), test: f.count(c.test) })),
      isImbalanced && f.line(`${K}.data.imbalance`, { big: big.name, small: small.name, ratio: f.decimal(big.train / small.train, 1) }),
      test === 0 ? f.line(`${K}.data.noTest`) : input.level === 'explore' && f.line(`${K}.data.why`),
    ],
    { kind: 'data', classes },
  );
}

function dataCheckScene(ctx: Ctx): LectureScene | null {
  const { f, input } = ctx;
  const checks = input.dataChecks;
  if (!checks) return null;
  const isClean = checks.leakPairs === 0 && checks.sameSplitPairs === 0 && !checks.shortcut;
  return scene(
    ctx,
    'data-check',
    [
      isClean && f.line(`${K}.check.ok`),
      checks.leakPairs > 0 && f.line(`${K}.check.leak`, { count: f.count(checks.leakPairs) }),
      checks.sameSplitPairs > 0 && f.line(`${K}.check.same`, { count: f.count(checks.sameSplitPairs) }),
      checks.shortcut && f.line(`${K}.check.shortcut`, { a: checks.shortcut.a, b: checks.shortcut.b, percent: f.percent(checks.shortcut.accuracy, 0) }),
    ],
    { kind: 'data-check', sameSplitPairs: checks.sameSplitPairs, leakPairs: checks.leakPairs, shortcutAccuracy: checks.shortcut?.accuracy ?? null },
  );
}

function networkScene(ctx: Ctx): LectureScene {
  const { f, input } = ctx;
  const dense = denseParams(input.classNames.length).total;
  const isExpert = input.level === 'expert';
  const model = f.term('MobileNetV2', 'MobileNet V hai');
  return scene(
    ctx,
    'network',
    [
      f.line(`${K}.network.features`, { model, dim: f.count(FEATURE_DIM) }),
      f.line(`${K}.network.frozen`),
      f.line(`${K}.network.head`, { params: f.count(dense), dim: f.count(FEATURE_DIM), classes: f.count(input.classNames.length) }),
      isExpert && f.line(`${K}.network.size`, { model, layers: f.count(MOBILENET_SUMMARY.totalLayers), params: f.count(MOBILENET_SUMMARY.totalParams) }),
      isExpert && f.line(`${K}.network.softmax`),
    ],
    {
      kind: 'network',
      totalLayers: MOBILENET_SUMMARY.totalLayers,
      frozenParams: MOBILENET_SUMMARY.totalParams,
      featureDim: FEATURE_DIM,
      denseParams: dense,
      classNames: input.classNames,
    },
  );
}

function trainingScene(ctx: Ctx): LectureScene {
  const { f, input, run } = ctx;
  const first = run.metrics[0];
  const last = lastMetrics(run);
  const isExpert = input.level === 'expert';
  const test = last?.testAccuracy ?? null;
  const train = last?.trainAccuracy ?? null;
  return scene(
    ctx,
    'training',
    [
      isExpert
        ? f.line(`${K}.training.setupExpert`, { number: f.count(run.number), epochs: f.count(run.options.epochs), lr: f.decimal(run.options.learningRate, 6) })
        : f.line(`${K}.training.setup`, { number: f.count(run.number), epochs: f.count(run.options.epochs) }),
      isExpert && first && last && f.line(`${K}.training.loss`, { from: f.decimal(first.trainLoss, 2), to: f.decimal(last.trainLoss, 2) }),
      train !== null && (test === null ? f.line(`${K}.training.trainOnly`, { train: f.percent(train) }) : f.line(`${K}.training.accuracy`, { train: f.percent(train), test: f.percent(test) })),
      train !== null && test !== null && train - test >= OVERFIT_GAP && f.line(`${K}.training.gap`, { gap: f.points(train - test) }),
      run.guess && f.line(`${K}.training.guess`, { guess: f.percent(run.guess.testAccuracy, 0) }),
    ],
    { kind: 'training', metrics: run.metrics, epochs: run.options.epochs },
  );
}

function findingLine(ctx: Ctx, finding: Finding): NarrationLine | null {
  const { f, input } = ctx;
  const name = (i: number) => input.classNames[i] ?? '';
  switch (finding.code) {
    case 'all-correct':
      return f.line(`${K}.evaluation.allCorrect`);
    case 'top-confusion':
      return f.line(`${K}.evaluation.topConfusion`, { count: f.count(finding.count), support: f.count(finding.support), actual: name(finding.actual), predicted: name(finding.predicted) });
    case 'weakest-class':
      return f.line(`${K}.evaluation.weakestClass`, { name: name(finding.classIndex), percent: f.percent(finding.recall, 0), other: name(finding.confusedWith) });
    case 'confident-mistakes':
      return f.line(`${K}.evaluation.confidentMistakes`, { count: f.count(finding.ids.length), percent: f.percent(finding.threshold, 0) });
    case 'small-set':
      return f.line(`${K}.evaluation.smallSet`, { total: f.count(finding.total), step: f.points(1 / finding.total) });
  }
}

function evaluationScene(ctx: Ctx): LectureScene | null {
  const { f, input, matrix, findings } = ctx;
  const items = input.evaluation?.items ?? [];
  if (items.length === 0) return null;
  const correct = items.filter((i) => i.actual === i.predicted).length;
  return scene(
    ctx,
    'evaluation',
    [f.line(`${K}.evaluation.result`, { total: f.count(items.length), correct: f.count(correct) }), ...findings.map((finding) => findingLine(ctx, finding))],
    { kind: 'evaluation', classNames: input.classNames, matrix, findings },
  );
}

function experimentsScene(ctx: Ctx): LectureScene | null {
  const { f, input, run } = ctx;
  if (input.runs.length < 2) return null;
  const scored = input.runs.map((r) => ({ number: r.number, testAccuracy: lastMetrics(r)?.testAccuracy ?? null }));
  const withTest = scored.filter((r): r is { number: number; testAccuracy: number } => r.testAccuracy !== null);
  const best = withTest.reduce<(typeof withTest)[number] | null>((b, r) => (!b || r.testAccuracy > b.testAccuracy ? r : b), null);
  const first = withTest[0];
  const last = withTest.at(-1);
  return scene(
    ctx,
    'experiments',
    [
      f.line(`${K}.experiments.count`, { count: f.count(input.runs.length) }),
      first && last && first !== last && f.line(`${K}.experiments.change`, { first: f.percent(first.testAccuracy), last: f.percent(last.testAccuracy) }),
      best && f.line(`${K}.experiments.best`, { best: f.percent(best.testAccuracy), number: f.count(best.number) }),
      input.includeStudentWriting && run.conclusion?.trim() && f.line(`${K}.experiments.conclusion`, { text: run.conclusion.trim() }),
    ],
    { kind: 'experiments', runs: scored },
  );
}

function limitsScene(ctx: Ctx): LectureScene {
  const { f, input } = ctx;
  const card = input.includeStudentWriting ? input.modelCard : null;
  // Thẻ lưu từ bản cũ có thể thiếu trường: đọc an toàn.
  const limitations = card?.limitations?.trim() ?? '';
  const misuse = card?.misuse?.trim() ?? '';
  return scene(
    ctx,
    'limits',
    [
      f.line(`${K}.limits.closedSet`, { count: f.count(input.classNames.length) }),
      limitations && f.line(`${K}.limits.cardLimitations`, { text: limitations }),
      misuse && f.line(`${K}.limits.cardMisuse`, { text: misuse }),
      f.line(`${K}.limits.human`),
    ],
    { kind: 'limits', classNames: input.classNames },
  );
}

function summaryScene(ctx: Ctx): LectureScene {
  const { f, findings, run } = ctx;
  const test = lastMetrics(run)?.testAccuracy ?? null;
  const train = lastMetrics(run)?.trainAccuracy ?? null;
  const confusion = findings.find((x) => x.code === 'top-confusion');
  const name = (i: number) => ctx.input.classNames[i] ?? '';
  const score = test !== null ? { split: 'test' as const, accuracy: test } : train !== null ? { split: 'train' as const, accuracy: train } : null;
  return scene(
    ctx,
    'summary',
    [
      test !== null && f.line(`${K}.summary.result`, { test: f.percent(test) }),
      test === null && train !== null && f.line(`${K}.summary.resultTrain`, { train: f.percent(train) }),
      confusion
        ? f.line(`${K}.summary.improve`, { actual: name(confusion.actual), predicted: name(confusion.predicted) })
        : f.line(`${K}.summary.harder`),
      f.line(`${K}.summary.question`),
    ],
    { kind: 'summary', score, confusion: confusion ? { actual: name(confusion.actual), predicted: name(confusion.predicted) } : null },
  );
}

/** Cảnh kết không có lời: chỉ hình (dòng chữ LUP Machine), hiện một khoảng cố định ở cuối video. */
function outroScene(ctx: Ctx): LectureScene {
  return scene(ctx, 'outro', [], { kind: 'outro' });
}

/** Dựng kịch bản bài giảng từ dữ liệu thật của một dự án ảnh. Trả null khi chưa huấn luyện lần nào. */
export function buildImageLecture(t: TFunction, language: string, input: ImageLectureInput): LectureScript | null {
  const run = input.runs.at(-1);
  if (!run) return null;
  const items = input.evaluation?.items ?? [];
  const ctx: Ctx = {
    t,
    f: lectureFormat(t, language),
    input,
    run,
    findings: findInsights(items, input.classNames.length),
    matrix: confusionMatrix(items, input.classNames.length),
  };
  const scenes = [
    titleScene(ctx),
    dataScene(ctx),
    dataCheckScene(ctx),
    networkScene(ctx),
    trainingScene(ctx),
    evaluationScene(ctx),
    experimentsScene(ctx),
    limitsScene(ctx),
    summaryScene(ctx),
    outroScene(ctx),
  ].filter((s): s is LectureScene => s !== null);
  return { language, level: input.level, scenes };
}
