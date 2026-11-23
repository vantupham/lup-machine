import reference from '../../../tests/fixtures/text-reference.json';
import { fitLogisticRegression, predictLogisticProba } from '@/core/algorithms/logistic-regression';
import { fitNaiveBayes, predictNaiveBayesProba } from './naive-bayes';
import { countVector, fitVocabulary, inverseDocumentFrequency, ngrams, termsOf, tfidfVector, tokenize } from './vectorize';

describe('tách âm tiết', () => {
  test('chữ thường, bỏ dấu câu, giữ âm tiết một chữ cái và chữ số', () => {
    expect(tokenize('Hôm nay, Em ở nhà! Đội thắng 2-1.')).toEqual(['hôm', 'nay', 'em', 'ở', 'nhà', 'đội', 'thắng', '2', '1']);
  });

  test('chuẩn hóa Unicode: chữ tổ hợp (NFD) và chữ dựng sẵn (NFC) cho cùng âm tiết', () => {
    expect(tokenize('Tiếng Việt'.normalize('NFD'))).toEqual(['tiếng', 'việt']);
  });

  test('n-gram: âm tiết đơn rồi tới cặp âm tiết liền nhau', () => {
    expect(ngrams(['học', 'sinh', 'giỏi'], 2)).toEqual(['học', 'sinh', 'giỏi', 'học sinh', 'sinh giỏi']);
    expect(ngrams(['a'], 2)).toEqual(['a']);
  });
});

describe('đối chiếu scikit-learn', () => {
  for (const c of reference.cases) {
    describe(`n-gram 1–${c.ngram}`, () => {
      const docs = reference.docs.map((d) => termsOf(d, c.ngram));
      const vocab = fitVocabulary(docs);
      const idf = inverseDocumentFrequency(vocab);
      const counts = docs.map((d) => countVector(vocab, d));
      const queries = reference.queries.map((q) => countVector(vocab, termsOf(q, c.ngram)));

      test('bộ từ vựng (cả thứ tự) và idf khớp TfidfVectorizer', () => {
        expect(vocab.terms).toEqual(c.vocabulary);
        idf.forEach((v, i) => expect(v).toBeCloseTo(c.idf[i]!, 12));
      });

      test('vector TF-IDF của câu Dạy và câu mới khớp', () => {
        counts.forEach((row, n) => tfidfVector(row, idf).forEach((v, j) => expect(v).toBeCloseTo(c.tfidf[n]![j]!, 12)));
        queries.forEach((row, n) => tfidfVector(row, idf).forEach((v, j) => expect(v).toBeCloseTo(c.queryTfidf[n]![j]!, 12)));
      });

      test('Naive Bayes: log P(lớp), log P(từ | lớp) và xác suất dự đoán khớp MultinomialNB', () => {
        const nb = fitNaiveBayes(counts, reference.labels, 3, 1);
        nb.classLogPrior.forEach((v, k) => expect(v).toBeCloseTo(c.nbClassLogPrior[k]!, 12));
        nb.featureLogProb.forEach((row, k) => row.forEach((v, j) => expect(v).toBeCloseTo(c.nbFeatureLogProb[k]![j]!, 12)));
        queries.forEach((q, n) => predictNaiveBayesProba(nb, q).forEach((p, k) => expect(p).toBeCloseTo(c.nbQueryProba[n]![k]!, 12)));
      });

      test('hồi quy logistic trên TF-IDF khớp LogisticRegression', () => {
        const model = fitLogisticRegression(counts.map((r) => tfidfVector(r, idf)), reference.labels, 3, { c: 10, tolerance: 1e-8 });
        model.weights.forEach((row, k) => row.forEach((w, j) => expect(w).toBeCloseTo(c.logisticCoef[k]![j]!, 5)));
        queries.forEach((q, n) =>
          predictLogisticProba(model, tfidfVector(q, idf)).forEach((p, k) => expect(p).toBeCloseTo(c.logisticQueryProba[n]![k]!, 6)),
        );
      });
    });
  }
});

describe('trường hợp đặc biệt', () => {
  test('câu toàn từ lạ: vector TF-IDF bằng 0, Naive Bayes trả về tỉ lệ lớp ban đầu', () => {
    const vocab = fitVocabulary([['mưa'], ['nắng'], ['mưa']]);
    const zero = countVector(vocab, ['bóng']);
    expect(tfidfVector(zero, inverseDocumentFrequency(vocab))).toEqual([0, 0]);
    const nb = fitNaiveBayes([[1, 0], [0, 1], [1, 0]], [0, 1, 0], 2);
    const p = predictNaiveBayesProba(nb, zero);
    expect(p[0]).toBeCloseTo(2 / 3);
  });

  test('báo lỗi với đầu vào không hợp lệ', () => {
    expect(() => fitNaiveBayes([], [], 2)).toThrow(RangeError);
    expect(() => fitNaiveBayes([[1]], [0, 1], 2)).toThrow(RangeError);
    expect(() => fitNaiveBayes([[1]], [0], 2, 0)).toThrow(RangeError);
  });
});
