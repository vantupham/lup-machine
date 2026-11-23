/**
 * Biến câu tiếng Việt thành vector số theo cách MINH BẠCH nhất: túi từ theo âm tiết và TF-IDF.
 * Khớp CountVectorizer / TfidfVectorizer của scikit-learn với token_pattern r"(?u)\b\w+\b"
 * (giữ cả âm tiết một chữ cái như "ở", "à"), chữ thường, n-gram nối bằng dấu cách, idf làm trơn, chuẩn hóa L2.
 */

/** Một âm tiết / từ: chuỗi liên tiếp chữ cái, chữ số hoặc dấu gạch dưới (giống \w của Python). */
const TOKEN_PATTERN = /[\p{L}\p{N}\p{M}_]+/gu;

export function tokenize(text: string): string[] {
  return text.normalize('NFC').toLowerCase().match(TOKEN_PATTERN) ?? [];
}

/** Âm tiết đơn rồi tới các cụm n âm tiết liền nhau (n = 2: "học sinh"), như scikit-learn. */
export function ngrams(tokens: readonly string[], maxN: number): string[] {
  const out = [...tokens];
  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

export function termsOf(text: string, maxN: number): string[] {
  return ngrams(tokenize(text), maxN);
}

export interface Vocabulary {
  /** Các từ / cụm từ, sắp theo thứ tự mã Unicode (giống scikit-learn). */
  readonly terms: readonly string[];
  readonly index: ReadonlyMap<string, number>;
  /** Số câu chứa mỗi từ. */
  readonly documentFrequency: readonly number[];
  readonly numDocuments: number;
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function fitVocabulary(documents: readonly (readonly string[])[]): Vocabulary {
  const df = new Map<string, number>();
  for (const terms of documents) for (const t of new Set(terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const terms = [...df.keys()].sort(compareCodePoints);
  return {
    terms,
    index: new Map(terms.map((t, i) => [t, i])),
    documentFrequency: terms.map((t) => df.get(t) as number),
    numDocuments: documents.length,
  };
}

/** Đếm số lần mỗi từ của bộ từ vựng xuất hiện; từ lạ bị bỏ qua. */
export function countVector(vocab: Vocabulary, terms: readonly string[]): number[] {
  const v = new Array<number>(vocab.terms.length).fill(0);
  for (const t of terms) {
    const i = vocab.index.get(t);
    if (i !== undefined) v[i]! += 1;
  }
  return v;
}

/** idf = ln((1 + số câu) / (1 + số câu chứa từ)) + 1: từ càng hiếm, idf càng lớn. */
export function inverseDocumentFrequency(vocab: Vocabulary): number[] {
  return vocab.documentFrequency.map((df) => Math.log((1 + vocab.numDocuments) / (1 + df)) + 1);
}

/** TF-IDF = số lần × idf, rồi chia cho độ dài vector để câu dài / ngắn so sánh được. */
export function tfidfVector(counts: readonly number[], idf: readonly number[]): number[] {
  const raw = counts.map((c, i) => c * (idf[i] as number));
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? raw : raw.map((v) => v / norm);
}
