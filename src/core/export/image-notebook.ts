/**
 * Notebook Colab cho dự án ảnh: chứa các vector đặc trưng MobileNetV2 (KHÔNG chứa ảnh gốc),
 * huấn luyện lại tầng phân loại bằng Keras, rồi ghép với MobileNetV2 để chuyển sang TensorFlow Lite.
 */
import { FEATURE_DIM } from '@/core/ml/feature-model';
import { code, float32ToBase64, markdown, notebook, pyList, pyNumber, pyString, type Notebook } from './notebook';

export interface LabeledFeatures {
  readonly xs: readonly ArrayLike<number>[];
  readonly ys: readonly number[];
}

export interface ImageNotebookInput {
  readonly projectName: string;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly classNames: readonly string[];
  readonly train: LabeledFeatures;
  readonly test: LabeledFeatures | null;
  readonly options: { readonly epochs: number; readonly learningRate: number; readonly batchSize: number; readonly seed: number };
  readonly results: { readonly trainAccuracy: number; readonly testAccuracy: number | null };
}

/** Kích thước ảnh và hệ số α của MobileNetV2 mà LUP Machine dùng (trọng số Keras Applications, ImageNet). */
export const MOBILENET = { alpha: 0.35, size: 224 } as const;

export function imageNotebook(input: ImageNotebookInput): Notebook {
  const { options, results } = input;
  const test = input.test ?? { xs: [], ys: [] };
  const total = input.train.xs.length + test.xs.length;

  return notebook([
    markdown(
      `# ${input.projectName} — notebook xuất từ LUP Machine`,
      '',
      'Notebook này huấn luyện lại **tầng phân loại** của dự án ảnh bằng **Keras**, rồi ghép với MobileNetV2 thành mô hình hoàn chỉnh và chuyển sang **TensorFlow Lite** (dùng trên điện thoại, Raspberry Pi…). Trình duyệt không tự chuyển sang TFLite được, nên bước này cần Python.',
      '',
      '- **Cách chạy:** trong Colab chọn *Thời gian chạy → Chạy tất cả* (Runtime → Run all).',
      `- **Dữ liệu:** ${total} ảnh, mỗi ảnh đã được MobileNetV2 biến thành ${FEATURE_DIM.toLocaleString('vi')} con số (vector đặc trưng). Notebook chỉ chứa các con số này, **không chứa ảnh gốc**.`,
      `- Xuất lúc ${input.exportedAt} từ LUP Machine ${input.appVersion}.`,
    ),
    code('import base64', 'import numpy as np', 'import keras', 'import tensorflow as tf', 'print("Keras", keras.__version__, "· TensorFlow", tf.__version__)'),
    markdown('## 1. Dữ liệu: vector đặc trưng và nhãn', '', 'Các vector được lưu dạng nhị phân (float32) rồi mã hóa base64 nên numpy đọc lại **đúng từng con số** mà LUP Machine đã tính.'),
    code(
      `CLASS_NAMES = ${pyList(input.classNames)}`,
      `FEATURE_DIM = ${FEATURE_DIM}`,
      '',
      'def decode(b64):',
      '    return np.frombuffer(base64.b64decode(b64), dtype="<f4").reshape(-1, FEATURE_DIM)',
      '',
      `X_train = decode(${pyString(float32ToBase64(input.train.xs))})`,
      `y_train = np.array(${pyList(input.train.ys)}, dtype="int64")`,
      `X_test = decode(${pyString(float32ToBase64(test.xs))})`,
      `y_test = np.array(${pyList(test.ys)}, dtype="int64")`,
      'print(f"Dạy: {X_train.shape}, Kiểm tra: {X_test.shape}")',
    ),
    markdown(
      '## 2. Huấn luyện tầng phân loại',
      '',
      'Giống LUP Machine: một tầng Dense + softmax, tối ưu bằng Adam với cùng số epoch, learning rate, kích thước lô và seed.',
      '',
      '> Kết quả sẽ **gần giống chứ không trùng khít** với LUP Machine: Keras khởi tạo trọng số và trộn dữ liệu bằng bộ sinh số ngẫu nhiên khác, nên đường đi của quá trình học hơi khác.',
    ),
    code(
      `EPOCHS, LEARNING_RATE, BATCH_SIZE, SEED = ${options.epochs}, ${pyNumber(options.learningRate)}, ${options.batchSize}, ${options.seed}`,
      'keras.utils.set_random_seed(SEED)',
      'head = keras.Sequential([',
      '    keras.Input(shape=(FEATURE_DIM,)),',
      '    keras.layers.Dense(len(CLASS_NAMES), activation="softmax", name="phan_loai"),',
      '])',
      'head.compile(optimizer=keras.optimizers.Adam(LEARNING_RATE), loss="sparse_categorical_crossentropy", metrics=["accuracy"])',
      'history = head.fit(X_train, y_train, epochs=EPOCHS, batch_size=BATCH_SIZE, verbose=0,',
      '                   validation_data=(X_test, y_test) if len(X_test) else None)',
      'print("Loss cuối:", round(history.history["loss"][-1], 4))',
    ),
    markdown('## 3. Đánh giá và so với LUP Machine'),
    code(
      `LUP = {"train_accuracy": ${pyNumber(results.trainAccuracy)}${results.testAccuracy === null ? '' : `, "test_accuracy": ${pyNumber(results.testAccuracy)}`}}`,
      'python = {"train_accuracy": float(np.mean(head.predict(X_train, verbose=0).argmax(1) == y_train))}',
      'if len(X_test):',
      '    pred_test = head.predict(X_test, verbose=0).argmax(1)',
      '    python["test_accuracy"] = float(np.mean(pred_test == y_test))',
      'for key, lup_value in LUP.items():',
      '    print(f"{key}: Keras {python[key]:.1%} · LUP Machine {lup_value:.1%}")',
    ),
    markdown(
      '## 4. Mô hình hoàn chỉnh: ảnh → nhãn',
      '',
      `Ghép MobileNetV2 (α = ${MOBILENET.alpha}, ảnh ${MOBILENET.size}×${MOBILENET.size}, trọng số ImageNet của Keras Applications — cùng trọng số LUP Machine dùng) với tầng phân loại vừa huấn luyện. Ảnh đưa vào là ảnh màu ${MOBILENET.size}×${MOBILENET.size}, giá trị điểm ảnh 0–255; mô hình tự chuẩn hóa về [−1, 1].`,
    ),
    code(
      `backbone = keras.applications.MobileNetV2(input_shape=(${MOBILENET.size}, ${MOBILENET.size}, 3), alpha=${MOBILENET.alpha}, include_top=False, weights="imagenet", pooling="avg")`,
      `inputs = keras.Input(shape=(${MOBILENET.size}, ${MOBILENET.size}, 3), name="anh")`,
      'x = keras.layers.Rescaling(1 / 127.5, offset=-1)(inputs)',
      'x = backbone(x, training=False)',
      'outputs = head(x)',
      'full_model = keras.Model(inputs, outputs, name="lup_machine")',
      'full_model.summary(show_trainable=False)',
    ),
    markdown('## 5. Chuyển sang TensorFlow Lite và tải về'),
    code(
      'full_model.export("lup_saved_model", verbose=False)',
      'tflite_bytes = tf.lite.TFLiteConverter.from_saved_model("lup_saved_model").convert()',
      'with open("lup_model.tflite", "wb") as f:',
      '    f.write(tflite_bytes)',
      'with open("labels.txt", "w", encoding="utf-8") as f:',
      '    f.write("\\n".join(CLASS_NAMES) + "\\n")',
      'print(f"lup_model.tflite: {len(tflite_bytes) / 1e6:.1f} MB")',
      '',
      '# Kiểm tra nhanh: mô hình TFLite cho cùng kết quả với Keras trên một ảnh ngẫu nhiên',
      'try:  # TF 2.20 trở đi chuyển trình chạy TFLite sang gói LiteRT',
      '    from ai_edge_litert.interpreter import Interpreter',
      'except ImportError:',
      '    Interpreter = tf.lite.Interpreter',
      'interpreter = Interpreter(model_content=tflite_bytes)',
      'interpreter.allocate_tensors()',
      `sample = np.random.default_rng(SEED).uniform(0, 255, size=(1, ${MOBILENET.size}, ${MOBILENET.size}, 3)).astype("float32")`,
      'interpreter.set_tensor(interpreter.get_input_details()[0]["index"], sample)',
      'interpreter.invoke()',
      'tflite_out = interpreter.get_tensor(interpreter.get_output_details()[0]["index"])',
      'print("Chênh lệch lớn nhất Keras ↔ TFLite:", float(np.abs(tflite_out - full_model.predict(sample, verbose=0)).max()))',
      '',
      'try:',
      '    from google.colab import files',
      '    files.download("lup_model.tflite")',
      '    files.download("labels.txt")',
      'except ImportError:',
      '    print("Không chạy trên Colab: hai tệp đã được lưu trong thư mục hiện tại.")',
    ),
  ]);
}
