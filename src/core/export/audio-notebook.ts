/**
 * Notebook Colab cho dự án âm thanh: chứa 160 đặc trưng ảnh phổ mel (dB) của mỗi đoạn, KHÔNG chứa âm thanh gốc;
 * dựng lại cùng mô hình bằng scikit-learn trên cùng cách chia Dạy / Kiểm tra và so kết quả với LUP Machine.
 */
import { AUDIO } from '@/core/audio/features';
import type { AudioData, AudioEvaluation, AudioModelSettings } from '@/core/audio/audio-model';
import { code, float32ToBase64, markdown, notebook, pyList, pyNumber, pyString, type Notebook } from './notebook';

export interface AudioNotebookInput {
  readonly projectName: string;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly data: AudioData;
  readonly settings: AudioModelSettings;
  readonly evaluation: AudioEvaluation;
}

export function audioNotebook(input: AudioNotebookInput): Notebook {
  const { data, settings, evaluation } = input;
  const isKnn = settings.kind === 'knn';
  const results = [
    ['train_accuracy', evaluation.trainAccuracy],
    ['test_accuracy', evaluation.testAccuracy],
  ].filter((e): e is [string, number] => e[1] !== null);

  return notebook([
    markdown(
      `# ${input.projectName} — notebook xuất từ LUP Machine`,
      '',
      'Notebook này dựng lại mô hình phân loại âm thanh của em bằng **Python và scikit-learn**, trên cùng dữ liệu và cùng cách chia tập Dạy / Kiểm tra, rồi so kết quả với LUP Machine.',
      '',
      '- **Cách chạy:** trong Colab chọn *Thời gian chạy → Chạy tất cả* (Runtime → Run all).',
      `- **Dữ liệu:** ${data.train.ys.length + data.test.ys.length} đoạn âm thanh 1 giây. Mỗi đoạn đã được biến thành ${AUDIO.nMels * AUDIO.timeSegments} con số: độ to trung bình (dB) của ${AUDIO.nMels} dải tần mel trong ${AUDIO.timeSegments} phần tư thời gian. Notebook **không chứa âm thanh gốc**.`,
      `- Xuất lúc ${input.exportedAt} từ LUP Machine ${input.appVersion}.`,
    ),
    code(
      'import base64',
      'import numpy as np',
      'import pandas as pd',
      'from sklearn.metrics import accuracy_score, confusion_matrix',
      isKnn ? 'from sklearn.neighbors import KNeighborsClassifier' : 'from sklearn.linear_model import LogisticRegression\nfrom sklearn.preprocessing import StandardScaler',
    ),
    markdown('## 1. Đặc trưng và nhãn', '', `Thứ tự 160 con số: \`x[đoạn * ${AUDIO.nMels} + dải]\` — đoạn 0–${AUDIO.timeSegments - 1} (thời gian), dải 0–${AUDIO.nMels - 1} (từ trầm tới bổng).`),
    code(
      `CLASS_NAMES = ${pyList(data.classNames)}`,
      `N_MELS, N_SEGMENTS = ${AUDIO.nMels}, ${AUDIO.timeSegments}`,
      '',
      'def decode(b64):',
      '    return np.frombuffer(base64.b64decode(b64), dtype="<f4").reshape(-1, N_MELS * N_SEGMENTS).astype(np.float64)',
      '',
      `X_train = decode(${pyString(float32ToBase64(data.train.raw))})`,
      `y_train = np.array(${pyList(data.train.ys)})`,
      `X_test = decode(${pyString(float32ToBase64(data.test.raw))})`,
      `y_test = np.array(${pyList(data.test.ys)})`,
      'print(f"Dạy: {X_train.shape}, Kiểm tra: {X_test.shape}")',
    ),
    markdown('## 2. Huấn luyện', '', isKnn ? 'k-NN đo khoảng cách trên dB gốc (không chuẩn hóa), giống LUP Machine.' : 'Hồi quy logistic trên đặc trưng đã chuẩn hóa theo tập Dạy, giống LUP Machine.'),
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
    ...(isKnn
      ? []
      : [
          markdown('## 4. Bản đồ vùng phổ quan trọng', '', 'Trọng số của mỗi lớp xếp lại thành lưới 40 dải × 4 đoạn: cam là ô càng to thì càng nghiêng về lớp đó, xanh là ngược lại.'),
          code(
            'import matplotlib.pyplot as plt',
            'W = model.coef_ if len(CLASS_NAMES) > 2 else np.vstack([-model.coef_[0], model.coef_[0]])',
            'W = W - W.mean(axis=0) if len(CLASS_NAMES) > 2 else W',
            'fig, axes = plt.subplots(1, len(CLASS_NAMES), figsize=(3 * len(CLASS_NAMES), 4))',
            'for ax, name, w in zip(np.atleast_1d(axes), CLASS_NAMES, W):',
            '    grid = w.reshape(N_SEGMENTS, N_MELS).T',
            '    lim = np.abs(grid).max()',
            '    ax.imshow(grid, origin="lower", aspect="auto", cmap="coolwarm", vmin=-lim, vmax=lim)',
            '    ax.set_title(name); ax.set_xlabel("đoạn thời gian"); ax.set_ylabel("dải mel")',
            'plt.tight_layout()',
          ),
        ]),
  ]);
}
