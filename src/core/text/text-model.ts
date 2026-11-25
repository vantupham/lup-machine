/**
 * Mô hình phân loại câu tiếng Việt: chia Huấn luyện / Kiểm tra, dựng bộ từ vựng TRÊN TẬP HUẤN LUYỆN,
 * huấn luyện Naive Bayes (số lần xuất hiện) hoặc hồi quy logistic (TF-IDF), và giải thích từng câu.
 *
 * Giải thích chính xác: điểm của lớp c so với trung bình các lớp, s_c − tb_k(s_k), tách được thành
 * (phần cố định của lớp) + Σ_từ (đóng góp của từ). Hồi quy logistic 2 lớp dùng thẳng logit z = w·x + b.
 */
import { stratifiedSplit } from '@/core/data/split';
import { fitLogisticRegression, logisticBase, logisticLeaning, logisticRelativeScore, predictLogisticProba, type LogisticModel } from '@/core/algorithms/logistic-regression';
import { accuracy, confusionMatrix } from '@/core/ml/metrics';
import { fitNaiveBayes, naiveBayesScores, predictNaiveBayesProba, type NaiveBayesModel } from './naive-bayes';
import { countVector, fitVocabulary, inverseDocumentFrequency, termsOf, tfidfVector, type Vocabulary } from './vectorize';

export type TextModelKind = 'naive-bayes' | 'logistic';

export interface TextModelSettings {
  readonly kind: TextModelKind;
  /** Naive Bayes: làm trơn α. */
  readonly alpha: number;
  /** Hồi quy logistic: C. */
  readonly c: number;
}

export interface TextExample {
  readonly text: string;
  readonly label: string;
}

export interface TextSplit {
  readonly texts: string[];
  readonly y: number[];
  /** Số thứ tự câu trong bảng gốc (bắt đầu từ 1). */
  readonly rowNumbers: number[];
}

export interface TextData {
  readonly classNames: readonly string[];
  readonly maxN: number;
  readonly train: TextSplit;
  readonly test: TextSplit;
  /** Bộ từ vựng dựng trên tập Huấn luyện. */
  readonly vocab: Vocabulary;
  readonly idf: readonly number[];
  /** Số câu bị bỏ vì trống hoặc thiếu nhãn. */
  readonly dropped: number;
}

export type TextPrepareError =
  | { readonly code: 'too-few-sentences'; readonly count: number }
  | { readonly code: 'single-class' }
  | { readonly code: 'too-many-classes'; readonly count: number };

export const MIN_SENTENCES = 6;
export const MAX_TEXT_CLASSES = 10;

const collator = new Intl.Collator('vi', { numeric: true });

export function prepareText(
  examples: readonly TextExample[],
  { testRatio, seed, maxN }: { readonly testRatio: number; readonly seed: number; readonly maxN: number },
): { ok: true; data: TextData } | { ok: false; error: TextPrepareError } {
  const usable = examples
    .map((e, i) => ({ id: String(i), label: e.label.trim(), text: e.text.trim(), rowNumber: i + 1 }))
    .filter((e) => e.label !== '' && e.text !== '');
  if (usable.length < MIN_SENTENCES) return { ok: false, error: { code: 'too-few-sentences', count: usable.length } };
  const classNames = [...new Set(usable.map((e) => e.label))].sort(collator.compare);
  if (classNames.length < 2) return { ok: false, error: { code: 'single-class' } };
  if (classNames.length > MAX_TEXT_CLASSES) return { ok: false, error: { code: 'too-many-classes', count: classNames.length } };

  const index = new Map(classNames.map((c, i) => [c, i]));
  const { train, test } = stratifiedSplit(usable, { testRatio, seed });
  const byRow = (a: { rowNumber: number }, b: { rowNumber: number }) => a.rowNumber - b.rowNumber;
  const toSplit = (list: typeof usable): TextSplit => {
    const sorted = [...list].sort(byRow);
    return { texts: sorted.map((e) => e.text), y: sorted.map((e) => index.get(e.label) as number), rowNumbers: sorted.map((e) => e.rowNumber) };
  };
  const trainSplit = toSplit(train);
  const vocab = fitVocabulary(trainSplit.texts.map((t) => termsOf(t, maxN)));
  return {
    ok: true,
    data: {
      classNames,
      maxN,
      train: trainSplit,
      test: toSplit(test),
      vocab,
      idf: inverseDocumentFrequency(vocab),
      dropped: examples.length - usable.length,
    },
  };
}

export interface EncodedText {
  readonly terms: string[];
  readonly counts: number[];
  readonly tfidf: number[];
}

export function encodeText(data: TextData, text: string): EncodedText {
  const terms = termsOf(text, data.maxN);
  const counts = countVector(data.vocab, terms);
  return { terms, counts, tfidf: tfidfVector(counts, data.idf) };
}

export type TrainedText =
  | { readonly kind: 'naive-bayes'; readonly model: NaiveBayesModel }
  | { readonly kind: 'logistic'; readonly model: LogisticModel };

export function trainText(data: TextData, settings: TextModelSettings): TrainedText {
  const k = data.classNames.length;
  if (settings.kind === 'naive-bayes') {
    const counts = data.train.texts.map((t) => encodeText(data, t).counts);
    return { kind: 'naive-bayes', model: fitNaiveBayes(counts, data.train.y, k, settings.alpha) };
  }
  const tfidf = data.train.texts.map((t) => encodeText(data, t).tfidf);
  return { kind: 'logistic', model: fitLogisticRegression(tfidf, data.train.y, k, { c: settings.c }) };
}

export function predictProbaText(trained: TrainedText, encoded: EncodedText): number[] {
  return trained.kind === 'naive-bayes'
    ? predictNaiveBayesProba(trained.model, encoded.counts)
    : predictLogisticProba(trained.model, encoded.tfidf);
}

/**
 * Trọng số "nghiêng về lớp c" của mỗi từ trong bộ từ vựng, tính cho MỘT lần xuất hiện (NB)
 * hoặc cho một đơn vị TF-IDF (logistic). Dùng để tô màu từ và liệt kê từ đặc trưng của lớp.
 */
export function classLeaning(trained: TrainedText, c: number): number[] {
  if (trained.kind === 'logistic') return logisticLeaning(trained.model, c);
  const rows = trained.model.featureLogProb;
  const k = rows.length;
  return (rows[c] as readonly number[]).map((v, j) => v - rows.reduce((s, r) => s + (r[j] as number), 0) / k);
}

export interface TermContribution {
  readonly term: string;
  /** Tổng đóng góp của từ (mọi lần xuất hiện) vào điểm của lớp đang xét. */
  readonly value: number;
}

export interface TextExplanation {
  readonly predicted: number;
  readonly proba: readonly number[];
  /** Phần không phụ thuộc vào từ nào (tỉ lệ lớp ban đầu / độ lệch). */
  readonly base: number;
  readonly contributions: readonly TermContribution[];
  /** base + Σ đóng góp = điểm này (để học sinh tự cộng lại kiểm tra). */
  readonly total: number;
  /** Các từ của câu không có trong bộ từ vựng Huấn luyện (máy bỏ qua). */
  readonly unknownTerms: readonly string[];
}

function relativeBase(trained: TrainedText, c: number): number {
  if (trained.kind === 'logistic') return logisticBase(trained.model, c);
  const base = trained.model.classLogPrior;
  return (base[c] as number) - base.reduce((a, b) => a + b, 0) / base.length;
}

export function explainText(trained: TrainedText, data: TextData, text: string, forClass?: number): TextExplanation {
  const encoded = encodeText(data, text);
  const proba = predictProbaText(trained, encoded);
  const predicted = proba.indexOf(Math.max(...proba));
  const c = forClass ?? predicted;
  const leaning = classLeaning(trained, c);
  const x = trained.kind === 'naive-bayes' ? encoded.counts : encoded.tfidf;
  const contributions = x
    .map((v, j) => ({ term: data.vocab.terms[j] as string, value: v * (leaning[j] as number) }))
    .filter((_, j) => (x[j] as number) !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const base = relativeBase(trained, c);
  return {
    predicted,
    proba,
    base,
    contributions,
    total: base + contributions.reduce((s, t) => s + t.value, 0),
    unknownTerms: [...new Set(encoded.terms.filter((t) => !data.vocab.index.has(t)))],
  };
}

/** Điểm tương đối của lớp c — đúng bằng base + Σ đóng góp (dùng trong kiểm thử). */
export function relativeScore(trained: TrainedText, encoded: EncodedText, c: number): number {
  if (trained.kind === 'logistic') return logisticRelativeScore(trained.model, encoded.tfidf, c);
  const s = naiveBayesScores(trained.model, encoded.counts);
  return (s[c] as number) - s.reduce((a, b) => a + b, 0) / s.length;
}

/** Các từ nghiêng về lớp c nhiều nhất (trong bộ từ vựng Huấn luyện). */
export function topTerms(trained: TrainedText, data: TextData, c: number, n: number): TermContribution[] {
  return classLeaning(trained, c)
    .map((value, j) => ({ term: data.vocab.terms[j] as string, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export interface TextEvaluation {
  readonly trainAccuracy: number | null;
  readonly testAccuracy: number | null;
  readonly confusion: number[][];
  readonly testPredictions: number[];
}

export function evaluateText(trained: TrainedText, data: TextData): TextEvaluation {
  const predict = (texts: readonly string[]) =>
    texts.map((t) => {
      const p = predictProbaText(trained, encodeText(data, t));
      return p.indexOf(Math.max(...p));
    });
  const trainPred = predict(data.train.texts);
  const testPred = predict(data.test.texts);
  return {
    trainAccuracy: accuracy(data.train.y, trainPred),
    testAccuracy: accuracy(data.test.y, testPred),
    confusion: confusionMatrix(data.test.y, testPred, data.classNames.length),
    testPredictions: testPred,
  };
}

export interface HighlightSpan {
  readonly text: string;
  /** null = không phải từ (dấu câu, khoảng trắng) hoặc từ lạ. */
  readonly value: number | null;
}

const WORD = /[\p{L}\p{N}\p{M}_]+/gu;

/**
 * Cắt câu gốc thành các đoạn để tô màu: mỗi âm tiết mang đóng góp của MỘT lần xuất hiện của nó
 * (âm tiết đơn; cặp âm tiết được liệt kê riêng trong bảng đóng góp).
 */
export function highlightSpans(trained: TrainedText, data: TextData, text: string, c: number): HighlightSpan[] {
  const normalized = text.normalize('NFC');
  const encoded = encodeText(data, normalized);
  const leaning = classLeaning(trained, c);
  const perOccurrence = (term: string): number | null => {
    const j = data.vocab.index.get(term);
    if (j === undefined) return null;
    if (trained.kind === 'naive-bayes') return leaning[j] as number;
    return ((encoded.tfidf[j] as number) / (encoded.counts[j] as number)) * (leaning[j] as number);
  };
  const spans: HighlightSpan[] = [];
  let last = 0;
  for (const m of normalized.matchAll(WORD)) {
    const start = m.index;
    if (start > last) spans.push({ text: normalized.slice(last, start), value: null });
    spans.push({ text: m[0], value: perOccurrence(m[0].toLowerCase()) });
    last = start + m[0].length;
  }
  if (last < normalized.length) spans.push({ text: normalized.slice(last), value: null });
  return spans;
}
