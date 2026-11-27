import type { DecisionTree } from '@/core/algorithms/decision-tree';
import ref from './tabular.reference.json';
import {
  KNN_PREDICT_PROGRAM,
  LINEAR_PREDICT_PROGRAM,
  pythonSigned,
  TABULAR_SCALE_PROGRAM,
  TREE_PREDICT_PROGRAM,
  traceKnnPredict,
  traceLinearPredict,
  traceScale,
  traceTreePredict,
} from './tabular-trace';
import type { PythonProgram } from './program';
import type { TraceStep } from './trace-value';

const all = (gen: Generator<TraceStep, unknown, void>) => [...(gen as Iterable<TraceStep>)];
const outputs = (steps: readonly TraceStep[]) => steps.flatMap((s) => (s.output ? [s.output] : []));
const expectLines = (steps: readonly TraceStep[], program: PythonProgram) => {
  for (const s of steps) expect(program.lines[s.line]).toBeDefined();
};

describe('chương trình Python của Studio bảng số khớp bản Python', () => {
  test('tabular_scale.py: trung bình, độ lệch chuẩn (cột không đổi thì 1) và giá trị đã chuẩn hóa', () => {
    const steps = all(traceScale({ rows: ref.scale.rows, columns: ref.scale.columns }));
    expect(outputs(steps)).toEqual(ref.scale.output);
    expectLines(steps, TABULAR_SCALE_PROGRAM);
  });

  test('tree_predict.py: đi từ gốc tới lá như bản Python', () => {
    const tree: DecisionTree = {
      numClasses: 3,
      numFeatures: 2,
      criterion: 'gini',
      nodes: ref.tree.nodes.map((n, id) => ({
        id,
        depth: 0,
        samples: n.counts.reduce((a, b) => a + b, 0),
        counts: n.counts,
        impurity: 0,
        split: n.split,
      })),
    };
    const steps = all(traceTreePredict({ x: ref.tree.x, tree, features: ref.tree.features, classNames: ref.tree.classNames }));
    expect(outputs(steps)).toEqual(ref.tree.output);
    expectLines(steps, TREE_PREDICT_PROGRAM);
  });

  test.each(['classification', 'regression'] as const)('knn_predict.py (%s): láng giềng và câu trả lời', (task) => {
    const steps = all(
      traceKnnPredict({
        x: ref.knn.x,
        train: ref.knn.train,
        ys: task === 'classification' ? ref.knn.labels : ref.knn.values,
        rowNumbers: ref.knn.rows,
        k: 3,
        task,
        classNames: task === 'classification' ? ref.tree.classNames : [],
      }),
    );
    expect(outputs(steps)).toEqual(ref.knn[task]);
    expectLines(steps, KNN_PREDICT_PROGRAM);
  });

  test('linear_predict.py: cộng từng đóng góp như bản Python', () => {
    const steps = all(traceLinearPredict({ x: ref.linear.x, model: { weights: ref.linear.w, intercept: ref.linear.b }, features: ref.linear.features }));
    expect(outputs(steps)).toEqual(ref.linear.output);
    expectLines(steps, LINEAR_PREDICT_PROGRAM);
  });

  test('số có dấu kiểu Python (:+.3f)', () => {
    expect(pythonSigned(1.5, 3)).toBe('+1.500');
    expect(pythonSigned(-1, 3)).toBe('-1.000');
    expect(pythonSigned(0, 3)).toBe('+0.000');
    expect(pythonSigned(-0, 3)).toBe('-0.000');
  });
});
