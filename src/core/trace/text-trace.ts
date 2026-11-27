/**
 * Vết chạy các chương trình Python của Studio văn bản:
 * `text_vectorize.py` (bước 3: câu → TF-IDF), `naive_bayes.py` (bước 4: huấn luyện Naive Bayes),
 * `text_predict.py` (bước 6: đoán một câu). Dùng đúng các hàm tách từ / đếm / idf của trang (src/core/text),
 * nên số trùng với bảng TF-IDF và mô hình trên trang; bản Python cho cùng dòng in (số đối chiếu).
 */
import { argmax } from '@/core/ml/metrics';
import { countVector, inverseDocumentFrequency, tokenize, type Vocabulary } from '@/core/text/vectorize';
import { createProgram, lineOf, type PythonProgram } from './program';
import { pythonFixed, pythonPercent, pythonStringList } from './python-format';
import { array, scalar, text, type TraceStep } from './trace-value';
import vectorizeSource from './python/text_vectorize.py?raw';
import naiveBayesSource from './python/naive_bayes.py?raw';
import predictSource from './python/text_predict.py?raw';

export const TEXT_VECTORIZE_PROGRAM = createProgram('text_vectorize.py', vectorizeSource);
export const NAIVE_BAYES_PROGRAM = createProgram('naive_bayes.py', naiveBayesSource);
export const TEXT_PREDICT_PROGRAM = createProgram('text_predict.py', predictSource);

/** Số mục hiện trong danh sách / từ điển rút gọn. */
const SHOWN_ITEMS = 6;

const step = (line: number, changed: TraceStep['changed'] = {}, output?: string): TraceStep =>
  output === undefined ? { line, changed, epoch: 0 } : { line, changed, epoch: 0, output };

const linesOf = <K extends string>(program: PythonProgram, anchors: Record<K, string>) =>
  Object.fromEntries(Object.entries<string>(anchors).map(([k, a]) => [k, lineOf(program, a)])) as Record<K, number>;

const pyRepr = (s: string) => `'${s}'`;
const list = (items: readonly string[]) => text(`${pythonStringList(items, SHOWN_ITEMS)} (${items.length})`);

/** Chỉ các mục khác 0, kiểu {'món': 1, 'ăn': 0.512, …}: vector từ vựng gần như toàn số 0. */
function nonzero(vocab: readonly string[], values: readonly number[], digits: number | null): ReturnType<typeof text> {
  const items = values.flatMap((v, j) => (v === 0 ? [] : [`'${vocab[j]}': ${digits === null ? v : pythonFixed(v, digits)}`]));
  const shown = items.slice(0, SHOWN_ITEMS);
  return text(`{${[...shown, ...(items.length > SHOWN_ITEMS ? ['…'] : [])].join(', ')}} (${items.length} số khác 0 / ${values.length})`);
}

/** Âm tiết và cụm 2 âm tiết như `text_terms` trong lup_helpers.py (giống termsOf của trang khi maxN ≤ 2). */
function splitTerms(sentence: string, maxN: number): { tokens: string[]; pairs: string[] } {
  const tokens = tokenize(sentence);
  const pairs = maxN === 2 ? tokens.slice(0, -1).map((t, i) => `${t} ${tokens[i + 1]}`) : [];
  return { tokens, pairs };
}

// ── Bước 3: câu → TF-IDF ───────────────────────────────────────────────────────────────

const VEC = linesOf(TEXT_VECTORIZE_PROGRAM, {
  inputs: '# Đầu vào',
  tokens: 'tokens = re.findall(',
  pairs: 'pairs = [',
  terms: 'terms = tokens + pairs',
  counts: 'counts = [terms.count(',
  idf: 'idf = [math.log(',
  raw: 'raw = [c * w',
  norm: 'norm = math.sqrt(',
  tfidf: 'tfidf = [v / norm',
  loop: 'for j in sorted(',
  ifPositive: 'if tfidf[j] > 0',
  print: 'print(f"{vocab[j]}',
});

export interface VectorizeInput {
  readonly sentence: string;
  readonly maxN: number;
  readonly vocab: Vocabulary;
}

export function tfidfLine(term: string, count: number, idf: number, tfidf: number): string {
  return `${term}: đếm ${count}, idf ${pythonFixed(idf, 3)}, TF-IDF ${pythonFixed(tfidf, 3)}`;
}

export function* traceVectorize({ sentence, maxN, vocab }: VectorizeInput): Generator<TraceStep, void, void> {
  const V = vocab.terms.length;
  yield step(VEC.inputs, {
    sentence: text(pyRepr(sentence)),
    MAX_N: scalar(maxN, true),
    vocab: list(vocab.terms),
    df: array(vocab.documentFrequency, { shape: [V], isInt: true, size: SHOWN_ITEMS }),
    N: scalar(vocab.numDocuments, true),
  });
  const { tokens, pairs } = splitTerms(sentence, maxN);
  yield step(VEC.tokens, { tokens: list(tokens) });
  yield step(VEC.pairs, { pairs: list(pairs) });
  const terms = [...tokens, ...pairs];
  yield step(VEC.terms, { terms: list(terms) });
  const counts = countVector(vocab, terms);
  yield step(VEC.counts, { counts: nonzero(vocab.terms, counts, null) });
  const idf = inverseDocumentFrequency(vocab);
  yield step(VEC.idf, { idf: array(idf, { shape: [V] }) });
  const raw = counts.map((c, j) => c * idf[j]!);
  yield step(VEC.raw, { raw: nonzero(vocab.terms, raw, 3) });
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  yield step(VEC.norm, { norm: scalar(norm) });
  const tfidf = raw.map((v) => (norm ? v / norm : 0));
  yield step(VEC.tfidf, { tfidf: nonzero(vocab.terms, tfidf, 3) });
  const order = tfidf.map((_, j) => j).sort((a, b) => tfidf[b]! - tfidf[a]! || a - b);
  for (const j of order) {
    yield step(VEC.loop, { j: scalar(j, true) });
    yield step(VEC.ifPositive);
    if (tfidf[j]! > 0) yield step(VEC.print, {}, tfidfLine(vocab.terms[j]!, counts[j]!, idf[j]!, tfidf[j]!));
  }
}

// ── Bước 4: huấn luyện Naive Bayes ─────────────────────────────────────────────────────

const NB = linesOf(NAIVE_BAYES_PROGRAM, {
  inputs: '# Đầu vào',
  shape: 'n, V = X.shape',
  k: 'k = len(CLASS_NAMES)',
  sentences: 'sentences = np.zeros(',
  wordCount: 'word_count = np.zeros(',
  loop: 'for i in range(n)',
  addSentence: 'sentences[y[i]] += 1',
  addWords: 'word_count[y[i]] += X[i]',
  logPrior: 'log_prior = np.log(',
  totals: 'totals = word_count.sum(',
  logProb: 'log_prob = np.log(',
  classLoop: 'for c in range(k)',
  top: 'top = np.argsort(',
  print: 'print(f"{CLASS_NAMES[c]}',
});

export interface NaiveBayesInput {
  /** Số lần mỗi từ xuất hiện trong từng câu Huấn luyện. */
  readonly counts: readonly (readonly number[])[];
  readonly ys: readonly number[];
  readonly vocab: readonly string[];
  readonly classNames: readonly string[];
  readonly alpha: number;
}

/** 3 từ có log P(từ | lớp) lớn nhất; bằng nhau thì từ đứng trước trong bộ từ vựng (argsort ổn định). */
export function topTerms(row: readonly number[], count = 3): number[] {
  return row.map((_, j) => j).sort((a, b) => row[b]! - row[a]! || a - b).slice(0, count);
}

export function* traceNaiveBayes({ counts, ys, vocab, classNames, alpha }: NaiveBayesInput): Generator<TraceStep, void, void> {
  const n = counts.length;
  const V = vocab.length;
  const k = classNames.length;
  yield step(NB.inputs, {
    X: array(counts[0] ?? [], { shape: [n, V], view: 'X[0, :3]', isInt: true }),
    y: array(ys, { shape: [n], isInt: true, size: SHOWN_ITEMS }),
    VOCAB: list(vocab),
    CLASS_NAMES: text(pythonStringList(classNames)),
    ALPHA: scalar(alpha),
  });
  yield step(NB.shape, { n: scalar(n, true), V: scalar(V, true) });
  yield step(NB.k, { k: scalar(k, true) });
  const sentences = new Array<number>(k).fill(0);
  yield step(NB.sentences, { sentences: array(sentences, { shape: [k], size: k }) });
  const wordCount = Array.from({ length: k }, () => new Array<number>(V).fill(0));
  yield step(NB.wordCount, { word_count: array(wordCount[0]!, { shape: [k, V], view: 'word_count[0, :3]' }) });
  for (let i = 0; i < n; i++) {
    yield step(NB.loop, { i: scalar(i, true) });
    const c = ys[i]!;
    sentences[c]! += 1;
    yield step(NB.addSentence, { sentences: array(sentences, { shape: [k], size: k }) });
    counts[i]!.forEach((v, j) => (wordCount[c]![j]! += v));
    yield step(NB.addWords, { word_count: nonzero(vocab, wordCount[c]!, null) });
  }
  const logPrior = sentences.map((s) => Math.log(s / n));
  yield step(NB.logPrior, { log_prior: array(logPrior, { shape: [k], size: k }) });
  const totals = wordCount.map((row) => row.reduce((a, b) => a + b, 0) + alpha * V);
  yield step(NB.totals, { totals: array(totals, { shape: [k, 1], size: k }) });
  const logProb = wordCount.map((row, c) => row.map((v) => Math.log((v + alpha) / totals[c]!)));
  yield step(NB.logProb, { log_prob: array(logProb[0]!, { shape: [k, V], view: 'log_prob[0, :3]' }) });
  for (let c = 0; c < k; c++) {
    yield step(NB.classLoop, { c: scalar(c, true) });
    const top = topTerms(logProb[c]!);
    yield step(NB.top, { top: array(top, { shape: [top.length], isInt: true }) });
    yield step(NB.print, {}, `${classNames[c]}: ${sentences[c]} câu, hay gặp: ${top.map((j) => vocab[j]).join(', ')}`);
  }
}

// ── Bước 6: đoán một câu ─────────────────────────────────────────────────────────────

const PRED = linesOf(TEXT_PREDICT_PROGRAM, {
  inputs: '# Đầu vào',
  terms: 'terms = text_terms(',
  x: 'x = np.array(',
  scores: 'scores = log_prior + log_prob @ x',
  exp: 'p = np.exp(',
  normalize: 'p = p / p.sum()',
  loop: 'for c in range(len(CLASS_NAMES))',
  printClass: 'print(f"{CLASS_NAMES[c]}: {p[c]',
  printGuess: 'print(f"Máy đoán',
});

export interface TextPredictInput {
  readonly sentence: string;
  readonly maxN: number;
  readonly vocab: Vocabulary;
  readonly classLogPrior: readonly number[];
  readonly featureLogProb: readonly (readonly number[])[];
  readonly classNames: readonly string[];
}

export function* traceTextPredict(input: TextPredictInput): Generator<TraceStep, void, void> {
  const { sentence, maxN, vocab, classLogPrior, featureLogProb, classNames } = input;
  const k = classLogPrior.length;
  yield step(PRED.inputs, {
    sentence: text(pyRepr(sentence)),
    MAX_N: scalar(maxN, true),
    vocab: list(vocab.terms),
    log_prior: array(classLogPrior, { shape: [k], size: k }),
    log_prob: array(featureLogProb[0] ?? [], { shape: [k, vocab.terms.length], view: 'log_prob[0, :3]' }),
    CLASS_NAMES: text(pythonStringList(classNames)),
  });
  const { tokens, pairs } = splitTerms(sentence, maxN);
  const terms = [...tokens, ...pairs];
  yield step(PRED.terms, { terms: list(terms) });
  const x = countVector(vocab, terms);
  yield step(PRED.x, { x: nonzero(vocab.terms, x, null) });
  const scores = featureLogProb.map((row, c) => row.reduce((s, lp, j) => s + lp * x[j]!, classLogPrior[c]!));
  yield step(PRED.scores, { scores: array(scores, { shape: [k], size: k }) });
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  yield step(PRED.exp, { p: array(exps, { shape: [k], size: k }) });
  const sum = exps.reduce((a, b) => a + b, 0);
  const p = exps.map((v) => v / sum);
  yield step(PRED.normalize, { p: array(p, { shape: [k], size: k }) });
  for (let c = 0; c < classNames.length; c++) {
    yield step(PRED.loop, { c: scalar(c, true) });
    yield step(PRED.printClass, {}, `${classNames[c]}: ${pythonPercent(p[c]!, 1)}`);
  }
  yield step(PRED.printGuess, {}, `Máy đoán: ${classNames[argmax(p)]}`);
}
