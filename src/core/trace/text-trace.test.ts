import { fitNaiveBayes } from '@/core/text/naive-bayes';
import { countVector, fitVocabulary, termsOf } from '@/core/text/vectorize';
import ref from './text.reference.json';
import {
  NAIVE_BAYES_PROGRAM,
  TEXT_PREDICT_PROGRAM,
  TEXT_VECTORIZE_PROGRAM,
  topTerms,
  traceNaiveBayes,
  traceTextPredict,
  traceVectorize,
} from './text-trace';
import type { TraceStep } from './trace-value';

const all = (gen: Generator<TraceStep, unknown, void>) => [...(gen as Iterable<TraceStep>)];
const outputs = (steps: readonly TraceStep[]) => steps.flatMap((s) => (s.output ? [s.output] : []));

const { sentences, ys, classNames, maxN, probe, alpha } = ref.input;
const docs = sentences.map((s) => termsOf(s, maxN));
const vocab = fitVocabulary(docs);
const counts = docs.map((d) => countVector(vocab, d));
const model = fitNaiveBayes(counts, ys, classNames.length, alpha);

describe('chương trình Python của Studio văn bản khớp trang và bản Python', () => {
  test('bộ từ vựng của trang trùng bộ từ vựng Python (sắp theo mã Unicode)', () => {
    expect(vocab.terms).toEqual(ref.vocab);
  });

  test('text_vectorize.py: cùng các dòng TF-IDF', () => {
    const steps = all(traceVectorize({ sentence: probe, maxN, vocab }));
    expect(outputs(steps)).toEqual(ref.vectorize);
    for (const s of steps) expect(TEXT_VECTORIZE_PROGRAM.lines[s.line]).toBeDefined();
  });

  test('naive_bayes.py: cùng dòng in; log P(từ | lớp) trùng mô hình của trang', () => {
    const steps = all(traceNaiveBayes({ counts, ys, vocab: vocab.terms, classNames, alpha }));
    expect(outputs(steps)).toEqual(ref.naiveBayes);
    for (const s of steps) expect(NAIVE_BAYES_PROGRAM.lines[s.line]).toBeDefined();
    model.featureLogProb.forEach((row, c) => row.forEach((v, j) => expect(v).toBeCloseTo(ref.logProb[c]![j]!, 12)));
    model.classLogPrior.forEach((v, c) => expect(v).toBeCloseTo(ref.logPrior[c]!, 12));
  });

  test('text_predict.py: cùng xác suất và câu trả lời', () => {
    const steps = all(
      traceTextPredict({ sentence: probe, maxN, vocab, classLogPrior: model.classLogPrior, featureLogProb: model.featureLogProb, classNames }),
    );
    expect(outputs(steps)).toEqual(ref.predict);
    for (const s of steps) expect(TEXT_PREDICT_PROGRAM.lines[s.line]).toBeDefined();
  });

  test('từ hay gặp: bằng nhau thì từ đứng trước trong bộ từ vựng', () => {
    expect(topTerms([-1, -0.5, -0.5, -2])).toEqual([1, 2, 0]);
  });

  test('câu không có từ nào trong bộ từ vựng: không in dòng TF-IDF nào', () => {
    expect(outputs(all(traceVectorize({ sentence: 'xyz', maxN, vocab })))).toEqual([]);
  });
});
