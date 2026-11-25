/**
 * Khung notebook Colab dùng chung cho các dự án dùng bộ phân loại vector (âm thanh, tư thế):
 * nhúng đặc trưng (float32 base64) + nhãn + cách chia, dựng lại cùng mô hình bằng scikit-learn và so với LUP Machine.
 * k-NN dùng đặc trưng gốc; hồi quy logistic dùng đặc trưng chuẩn hóa theo tập Huấn luyện — giống LUP Machine.
 */
import type { VectorData, VectorEvaluation, VectorModelSettings } from '@/core/ml/vector-classifier';
import { code, float32ToBase64, markdown, notebook, pyList, pyNumber, pyString, type Notebook, type NotebookCell } from './notebook';

export interface VectorNotebookInput {
  readonly projectName: string;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly data: VectorData;
  readonly settings: VectorModelSettings;
  readonly evaluation: VectorEvaluation;
}

export interface VectorNotebookText {
  /** Câu mở đầu: notebook làm gì với loại dữ liệu này. */
  readonly what: string;
  /** Dữ liệu gồm gì (và KHÔNG gồm gì: ảnh / âm thanh gốc). */
  readonly dataNote: string;
  /** Ý nghĩa và thứ tự các con số đặc trưng. */
  readonly layoutNote: string;
  /** Các ô vẽ hình riêng cho loại dữ liệu (chỉ thêm khi dùng hồi quy logistic). */
  readonly logisticExtras: readonly NotebookCell[];
}

export function vectorNotebook(input: VectorNotebookInput, text: VectorNotebookText): Notebook {
  const { data, settings, evaluation } = input;
  const isKnn = settings.kind === 'knn';
  const dim = data.train.raw[0]?.length ?? data.test.raw[0]?.length ?? 0;
  const results = [
    ['train_accuracy', evaluation.trainAccuracy],
    ['test_accuracy', evaluation.testAccuracy],
  ].filter((e): e is [string, number] => e[1] !== null);

  return notebook([
    markdown(
      `# ${input.projectName} — notebook xuất từ LUP Machine`,
      '',
      `${text.what} Dựng lại bằng **Python và scikit-learn**, trên cùng dữ liệu và cùng cách chia tập Huấn luyện / Kiểm tra, rồi so kết quả với LUP Machine.`,
      '',
      '- **Cách chạy:** trong Colab chọn *Thời gian chạy → Chạy tất cả* (Runtime → Run all).',
      `- **Dữ liệu:** ${text.dataNote}`,
      `- Xuất lúc ${input.exportedAt} từ LUP Machine ${input.appVersion}.`,
    ),
    code(
      'import base64',
      'import numpy as np',
      'import pandas as pd',
      'from sklearn.metrics import accuracy_score, confusion_matrix',
      isKnn ? 'from sklearn.neighbors import KNeighborsClassifier' : 'from sklearn.linear_model import LogisticRegression\nfrom sklearn.preprocessing import StandardScaler',
    ),
    markdown('## 1. Đặc trưng và nhãn', '', text.layoutNote),
    code(
      `CLASS_NAMES = ${pyList(data.classNames)}`,
      `DIM = ${dim}`,
      '',
      'def decode(b64):',
      '    return np.frombuffer(base64.b64decode(b64), dtype="<f4").reshape(-1, DIM).astype(np.float64)',
      '',
      `X_train = decode(${pyString(float32ToBase64(data.train.raw))})`,
      `y_train = np.array(${pyList(data.train.ys)})`,
      `X_test = decode(${pyString(float32ToBase64(data.test.raw))})`,
      `y_test = np.array(${pyList(data.test.ys)})`,
      'print(f"Huấn luyện: {X_train.shape}, Kiểm tra: {X_test.shape}")',
    ),
    markdown('## 2. Huấn luyện', '', isKnn ? 'k-NN đo khoảng cách trên đặc trưng gốc (không chuẩn hóa), giống LUP Machine.' : 'Hồi quy logistic trên đặc trưng đã chuẩn hóa theo tập Huấn luyện, giống LUP Machine.'),
    code(
      ...(isKnn
        ? [`model = KNeighborsClassifier(n_neighbors=${settings.k}, algorithm="brute").fit(X_train, y_train)`, 'Z_train, Z_test = X_train, X_test']
        : [
            'scaler = StandardScaler().fit(X_train)',
            'Z_train, Z_test = scaler.transform(X_train), scaler.transform(X_test)',
            `model = LogisticRegression(C=${pyNumber(settings.c)}, max_iter=10000).fit(Z_train, y_train)`,
          ]),
    ),
    markdown('## 3. Đánh giá và so với LUP Machine'),
    code(
      `LUP = {${results.map(([k, v]) => `${pyString(k)}: ${pyNumber(v)}`).join(', ')}}`,
      'python = {"train_accuracy": accuracy_score(y_train, model.predict(Z_train))}',
      'if len(y_test): python["test_accuracy"] = accuracy_score(y_test, model.predict(Z_test))',
      'for key, lup_value in LUP.items():',
      '    same = abs(python[key] - lup_value) <= 1e-6',
      '    print(f"{key}: Python {python[key]:.6g} · LUP Machine {lup_value:.6g} → {\'khớp\' if same else \'lệch\'}")',
      'pd.DataFrame(confusion_matrix(y_test, model.predict(Z_test), labels=range(len(CLASS_NAMES))), index=CLASS_NAMES, columns=CLASS_NAMES)',
    ),
    ...(isKnn ? [] : text.logisticExtras),
  ]);
}

/** Trọng số "nghiêng về lớp" (giống LUP Machine): 3 lớp trở lên trừ trung bình các lớp; 2 lớp dùng ±w. */
export const PY_LEANING = [
  'W = model.coef_ if len(CLASS_NAMES) > 2 else np.vstack([-model.coef_[0], model.coef_[0]])',
  'W = W - W.mean(axis=0) if len(CLASS_NAMES) > 2 else W',
];
