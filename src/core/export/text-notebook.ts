/**
 * Notebook Colab cho dự án văn bản: dựng lại đúng bộ từ vựng, TF-IDF / số lần xuất hiện và mô hình
 * bằng scikit-learn, trên cùng các câu và cùng cách chia Huấn luyện / Kiểm tra, rồi so kết quả với LUP Machine.
 */
import type { TextData, TextEvaluation, TextModelSettings } from '@/core/text/text-model';
import { code, markdown, notebook, pyList, pyNumber, pyString, type Notebook } from './notebook';

export interface TextNotebookInput {
  readonly projectName: string;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly data: TextData;
  readonly settings: TextModelSettings;
  readonly evaluation: TextEvaluation;
}

export function textNotebook(input: TextNotebookInput): Notebook {
  const { data, settings, evaluation } = input;
  const isNb = settings.kind === 'naive-bayes';
  const results: [string, number][] = [
    ['train_accuracy', evaluation.trainAccuracy],
    ['test_accuracy', evaluation.testAccuracy],
  ].filter((e): e is [string, number] => e[1] !== null);

  return notebook([
    markdown(
      `# ${input.projectName} — notebook xuất từ LUP Machine`,
      '',
      'Notebook này dựng lại mô hình phân loại câu tiếng Việt của em bằng **Python và scikit-learn**, trên **cùng các câu** và **cùng cách chia** tập Huấn luyện / Kiểm tra, rồi so kết quả với LUP Machine.',
      '',
      '- **Cách chạy:** trong Colab chọn *Thời gian chạy → Chạy tất cả* (Runtime → Run all).',
      `- **Dữ liệu:** ${data.train.texts.length} câu Huấn luyện và ${data.test.texts.length} câu Kiểm tra, nằm ngay trong notebook.`,
      `- Xuất lúc ${input.exportedAt} từ LUP Machine ${input.appVersion}.`,
    ),
    code(
      'import numpy as np',
      'import pandas as pd',
      isNb ? 'from sklearn.feature_extraction.text import CountVectorizer' : 'from sklearn.feature_extraction.text import TfidfVectorizer',
      isNb ? 'from sklearn.naive_bayes import MultinomialNB' : 'from sklearn.linear_model import LogisticRegression',
      'from sklearn.metrics import accuracy_score, confusion_matrix',
    ),
    markdown('## 1. Các câu và nhãn'),
    code(
      `CLASS_NAMES = ${pyList(data.classNames)}`,
      `train_texts = ${pyList(data.train.texts)}`,
      `y_train = np.array(${pyList(data.train.y)})`,
      `test_texts = ${pyList(data.test.texts)}`,
      `y_test = np.array(${pyList(data.test.y)})`,
      'print(f"{len(train_texts)} câu Huấn luyện, {len(test_texts)} câu Kiểm tra")',
    ),
    markdown(
      '## 2. Biến câu thành vector',
      '',
      'Tách âm tiết bằng mẫu `\\w+` (giữ cả âm tiết một chữ cái như "ở", "à"), đổi sang chữ thường. Bộ từ vựng chỉ dựng từ **tập Huấn luyện**.',
      isNb ? 'Naive Bayes dùng **số lần** mỗi từ xuất hiện.' : 'Hồi quy logistic dùng **TF-IDF**: số lần × độ hiếm của từ, rồi chuẩn hóa độ dài.',
    ),
    code(
      `vectorizer = ${isNb ? 'CountVectorizer' : 'TfidfVectorizer'}(token_pattern=r"(?u)\\b\\w+\\b", ngram_range=(1, ${data.maxN}))`,
      'X_train = vectorizer.fit_transform(train_texts)',
      'X_test = vectorizer.transform(test_texts)',
      'print("Số từ trong bộ từ vựng:", len(vectorizer.vocabulary_))',
    ),
    markdown('## 3. Huấn luyện'),
    code(
      isNb ? `model = MultinomialNB(alpha=${pyNumber(settings.alpha)})` : `model = LogisticRegression(C=${pyNumber(settings.c)}, max_iter=10000)`,
      'model.fit(X_train, y_train)',
    ),
    markdown('## 4. Đánh giá và so với LUP Machine'),
    code(
      `LUP = {${results.map(([k, v]) => `${pyString(k)}: ${pyNumber(v)}`).join(', ')}}`,
      'python = {"train_accuracy": accuracy_score(y_train, model.predict(X_train))}',
      'if len(test_texts): python["test_accuracy"] = accuracy_score(y_test, model.predict(X_test))',
      'for key, lup_value in LUP.items():',
      '    same = abs(python[key] - lup_value) <= 1e-6',
      '    print(f"{key}: Python {python[key]:.6g} · LUP Machine {lup_value:.6g} → {\'khớp\' if same else \'lệch\'}")',
      'pd.DataFrame(confusion_matrix(y_test, model.predict(X_test), labels=range(len(CLASS_NAMES))), index=CLASS_NAMES, columns=CLASS_NAMES)',
    ),
    markdown('## 5. Từ nào đặc trưng cho mỗi lớp?', '', isNb ? 'Với Naive Bayes: log P(từ | lớp) trừ đi trung bình các lớp — số càng lớn, từ càng nghiêng về lớp đó.' : 'Với hồi quy logistic: trọng số của từ (với 3 lớp trở lên, trừ đi trung bình các lớp).'),
    code(
      'terms = vectorizer.get_feature_names_out()',
      isNb ? 'weights = model.feature_log_prob_' : 'weights = model.coef_ if len(CLASS_NAMES) > 2 else np.vstack([-model.coef_[0], model.coef_[0]])',
      isNb ? 'leaning = weights - weights.mean(axis=0)' : 'leaning = weights - weights.mean(axis=0) if len(CLASS_NAMES) > 2 else weights',
      'for c, name in enumerate(CLASS_NAMES):',
      '    top = np.argsort(-leaning[c])[:8]',
      '    print(f"{name}: " + " · ".join(terms[top]))',
    ),
    markdown('## 6. Thử một câu mới', '', 'Sửa câu trong `sentence` rồi chạy lại ô này.'),
    code(
      `sentence = ${pyString(data.test.texts[0] ?? data.train.texts[0] ?? '')}`,
      'proba = model.predict_proba(vectorizer.transform([sentence]))[0]',
      'for name, p in sorted(zip(CLASS_NAMES, proba), key=lambda x: -x[1]):',
      '    print(f"{name}: {p:.1%}")',
    ),
  ]);
}
