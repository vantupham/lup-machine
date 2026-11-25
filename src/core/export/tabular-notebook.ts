/**
 * Notebook Colab cho dự án dữ liệu bảng: dựng lại ĐÚNG mô hình bằng pandas + scikit-learn
 * trên cùng dữ liệu và cùng cách chia Huấn luyện / Kiểm tra, rồi so kết quả với LUP Machine.
 */
import type { ParsedTable } from '@/core/tabular/csv';
import { parseNumber } from '@/core/tabular/columns';
import type { Evaluation } from '@/core/tabular/models';
import type { PreparedData } from '@/core/tabular/prepare';
import type { TabularModelSettings } from '@/storage/schemas/tabular';
import { code, markdown, notebook, pyList, pyNumber, pyString, type Notebook } from './notebook';

export const SPLIT_COLUMN = 'lup_split';

export interface TabularNotebookInput {
  readonly projectName: string;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly table: ParsedTable;
  readonly data: PreparedData;
  readonly settings: TabularModelSettings;
  readonly evaluation: Evaluation;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Bảng đã làm sạch: chỉ các cột dùng tới, chỉ các dòng dùng được, số viết bằng dấu chấm, thêm cột Huấn luyện / Kiểm tra. */
export function cleanedCsv(table: ParsedTable, data: PreparedData): string {
  const index = (name: string) => table.headers.indexOf(name);
  const featureIdx = data.encoders.map((e) => index(e.name));
  const targetIdx = index(data.target);
  const split = new Map<number, string>([
    ...data.train.rowNumbers.map((r): [number, string] => [r, 'train']),
    ...data.test.rowNumbers.map((r): [number, string] => [r, 'test']),
  ]);
  const lines = [[...data.encoders.map((e) => e.name), data.target, SPLIT_COLUMN].map(csvCell).join(',')];
  table.rows.forEach((row, i) => {
    const part = split.get(i + 1);
    if (!part) return;
    const cells = data.encoders.map((e, j) => {
      const cell = (row[featureIdx[j] as number] as string).trim();
      return e.kind === 'numeric' ? pyNumber(parseNumber(cell) as number) : cell;
    });
    const target = (row[targetIdx] as string).trim();
    cells.push(data.task === 'regression' ? pyNumber(parseNumber(target) as number) : target, part);
    lines.push(cells.map(csvCell).join(','));
  });
  return `${lines.join('\n')}\n`;
}

const MODEL_CODE: Record<TabularModelSettings['kind'], (s: TabularModelSettings) => string[]> = {
  tree: (s) => [
    'from sklearn.tree import DecisionTreeClassifier',
    `model = DecisionTreeClassifier(criterion=${pyString(s.criterion)}, max_depth=${s.maxDepth}, random_state=0)`,
    'X_train, X_test = X_train_raw, X_test_raw  # cây dùng số gốc',
  ],
  logistic: (s) => [
    'from sklearn.linear_model import LogisticRegression',
    `model = LogisticRegression(C=${pyNumber(s.c)}, max_iter=10000)`,
    'X_train, X_test = X_train_scaled, X_test_scaled  # logistic dùng số đã chuẩn hóa',
  ],
  knn: (s) => [
    'from sklearn.neighbors import KNeighborsClassifier',
    `model = KNeighborsClassifier(n_neighbors=${s.k}, algorithm="brute")`,
    'X_train, X_test = X_train_scaled, X_test_scaled  # k-NN đo khoảng cách trên số đã chuẩn hóa',
  ],
  linear: () => [
    'from sklearn.linear_model import LinearRegression',
    'model = LinearRegression()',
    'X_train, X_test = X_train_raw, X_test_raw  # hệ số đọc theo đơn vị thật',
  ],
  'knn-regression': (s) => [
    'from sklearn.neighbors import KNeighborsRegressor',
    `model = KNeighborsRegressor(n_neighbors=${s.k}, algorithm="brute")`,
    'X_train, X_test = X_train_scaled, X_test_scaled  # k-NN đo khoảng cách trên số đã chuẩn hóa',
  ],
};

const EXPLAIN_CODE: Record<TabularModelSettings['kind'], string[]> = {
  tree: [
    'from sklearn.tree import export_text',
    'print(export_text(model, feature_names=list(X_train.columns), decimals=3))',
    'pd.Series(model.feature_importances_, index=X_train.columns, name="độ quan trọng").sort_values(ascending=False)',
  ],
  logistic: [
    'rows = [CLASS_NAMES[1]] if len(CLASS_NAMES) == 2 else CLASS_NAMES',
    'weights = pd.DataFrame(model.coef_, index=[f"điểm lớp {c}" for c in rows], columns=X_train.columns)',
    'weights["độ lệch"] = model.intercept_',
    'weights.round(3)',
  ],
  knn: ['print(f"k-NN không học trọng số: nó ghi nhớ {len(X_train)} dòng Huấn luyện và tìm {model.n_neighbors} dòng gần nhất mỗi lần dự đoán.")'],
  linear: [
    'print(f"độ lệch = {model.intercept_:.4f}")',
    'pd.Series(model.coef_, index=X_train.columns, name="hệ số").round(4)',
  ],
  'knn-regression': ['print(f"k-NN không học trọng số: nó lấy trung bình {model.n_neighbors} dòng Huấn luyện gần nhất.")'],
};

function lupResults(evaluation: Evaluation): [string, number][] {
  const entries: [string, number | null][] =
    evaluation.task === 'classification'
      ? [['train_accuracy', evaluation.train.accuracy], ['test_accuracy', evaluation.test.accuracy]]
      : [['train_r2', evaluation.train.r2], ['test_r2', evaluation.test.r2], ['train_mse', evaluation.train.mse], ['test_mse', evaluation.test.mse]];
  return entries.filter((e): e is [string, number] => e[1] !== null);
}

export function tabularNotebook(input: TabularNotebookInput): Notebook {
  const { data, settings, evaluation } = input;
  const isClassification = data.task === 'classification';
  const numeric = data.encoders.filter((e) => e.kind === 'numeric').map((e) => e.name);
  const categories = data.encoders.flatMap((e) => (e.kind === 'categorical' ? [`    ${pyString(e.name)}: ${pyList(e.categories)},`] : []));
  const stringColumns = [...data.encoders.filter((e) => e.kind === 'categorical').map((e) => e.name), ...(isClassification ? [data.target] : [])];
  const results = lupResults(evaluation);
  const total = data.train.y.length + data.test.y.length;

  return notebook([
    markdown(
      `# ${input.projectName} — notebook xuất từ LUP Machine`,
      '',
      'Notebook này dựng lại mô hình em đã huấn luyện trên LUP Machine bằng **Python, pandas và scikit-learn**, trên **cùng dữ liệu** và **cùng cách chia** tập Huấn luyện / Kiểm tra, rồi so kết quả với LUP Machine.',
      '',
      '- **Cách chạy:** trong Colab chọn *Thời gian chạy → Chạy tất cả* (Runtime → Run all).',
      `- **Dữ liệu:** ${total} dòng dùng được, nằm ngay trong notebook (không tải từ đâu về).${data.dropped > 0 ? ` ${data.dropped} dòng thiếu giá trị đã được bỏ, giống trên LUP Machine.` : ''}`,
      `- Xuất lúc ${input.exportedAt} từ LUP Machine ${input.appVersion}.`,
    ),
    code('import io', 'import numpy as np', 'import pandas as pd', 'from sklearn.preprocessing import StandardScaler', 'from sklearn.metrics import accuracy_score, confusion_matrix, mean_squared_error, r2_score'),
    markdown('## 1. Dữ liệu', '', `Cột \`${SPLIT_COLUMN}\` ghi mỗi dòng thuộc tập Huấn luyện (\`train\`) hay Kiểm tra (\`test\`), đúng như trên LUP Machine.`),
    code(
      `CSV = ${pyString(cleanedCsv(input.table, data))}`,
      '',
      `TARGET = ${pyString(data.target)}  # cột cần dự đoán`,
      `FEATURES = ${pyList(data.encoders.map((e) => e.name))}  # các cột máy được dùng`,
      `NUMERIC = ${pyList(numeric)}`,
      'CATEGORIES = {  # cột chữ và các giá trị gặp trong tập Huấn luyện',
      ...categories,
      '}',
      ...(isClassification ? [`CLASS_NAMES = ${pyList(data.classNames)}`] : []),
      '',
      `df = pd.read_csv(io.StringIO(CSV), dtype={c: str for c in ${pyList(stringColumns)}}, keep_default_na=False)`,
      `train = df[df[${pyString(SPLIT_COLUMN)}] == "train"]`,
      `test = df[df[${pyString(SPLIT_COLUMN)}] == "test"]`,
      'print(f"{len(train)} dòng Huấn luyện, {len(test)} dòng Kiểm tra")',
      'df.head()',
    ),
    markdown('## 2. Biến bảng thành các con số', '', 'Cột số giữ nguyên ("thô") hoặc chuẩn hóa *z = (x − trung bình) / độ lệch chuẩn* (tính trên tập Huấn luyện). Cột chữ được mã hóa **one-hot**: mỗi giá trị thành một cột 0/1.'),
    code(
      'def to_matrix(part):',
      '    columns = {}',
      '    for name in FEATURES:',
      '        if name in CATEGORIES:',
      '            for value in CATEGORIES[name]:',
      '                columns[f"{name} = {value}"] = (part[name] == value).astype(float)',
      '        else:',
      '            columns[name] = part[name].astype(float)',
      '    return pd.DataFrame(columns, index=part.index)',
      '',
      'X_train_raw, X_test_raw = to_matrix(train), to_matrix(test)',
      'X_train_scaled, X_test_scaled = X_train_raw.copy(), X_test_raw.copy()',
      'if NUMERIC:',
      '    scaler = StandardScaler().fit(X_train_raw[NUMERIC])',
      '    X_train_scaled[NUMERIC] = scaler.transform(X_train_raw[NUMERIC])',
      '    X_test_scaled[NUMERIC] = scaler.transform(X_test_raw[NUMERIC])',
      '',
      isClassification
        ? 'y_train, y_test = train[TARGET].map(CLASS_NAMES.index).to_numpy(), test[TARGET].map(CLASS_NAMES.index).to_numpy()'
        : 'y_train, y_test = train[TARGET].astype(float).to_numpy(), test[TARGET].astype(float).to_numpy()',
      'X_train_scaled.head()',
    ),
    markdown('## 3. Huấn luyện', '', 'Cùng loại mô hình và cùng tham số như trên LUP Machine.'),
    code(...MODEL_CODE[settings.kind](settings), 'model.fit(X_train, y_train)'),
    markdown('## 4. Đánh giá và so với LUP Machine'),
    code(
      `LUP = {${results.map(([k, v]) => `${pyString(k)}: ${pyNumber(v)}`).join(', ')}}`,
      'pred_train, pred_test = model.predict(X_train), model.predict(X_test)',
      ...(isClassification
        ? [
            'python = {"train_accuracy": accuracy_score(y_train, pred_train)}',
            'if len(y_test): python["test_accuracy"] = accuracy_score(y_test, pred_test)',
          ]
        : [
            'python = {"train_r2": r2_score(y_train, pred_train), "train_mse": mean_squared_error(y_train, pred_train)}',
            'if len(y_test): python.update(test_r2=r2_score(y_test, pred_test), test_mse=mean_squared_error(y_test, pred_test))',
          ]),
      'for key, lup_value in LUP.items():',
      '    same = abs(python[key] - lup_value) <= 1e-6 * max(1.0, abs(lup_value))',
      '    print(f"{key}: Python {python[key]:.6g} · LUP Machine {lup_value:.6g} → {\'khớp\' if same else \'lệch\'}")',
      ...(isClassification
        ? ['pd.DataFrame(confusion_matrix(y_test, pred_test, labels=range(len(CLASS_NAMES))), index=CLASS_NAMES, columns=CLASS_NAMES)']
        : []),
    ),
    markdown(
      'Hai bên dùng cùng thuật toán nên kết quả thường **khớp**. Nếu có chỗ lệch nhỏ, lý do có thể là:',
      '- **k-NN:** khi hai dòng Huấn luyện cách đều điểm cần đoán, mỗi chương trình chọn một dòng khác nhau.',
      '- **Cây quyết định:** khi hai câu hỏi tốt ngang nhau, scikit-learn chọn ngẫu nhiên (theo `random_state`), còn LUP Machine chọn cột đứng trước.',
      '- **Hồi quy logistic:** hai bên tối ưu tới sai số rất nhỏ nhưng không bằng 0.',
    ),
    markdown('## 5. Mô hình đã học được gì?'),
    code(...EXPLAIN_CODE[settings.kind]),
    markdown('## 6. Thử dự đoán', '', 'Sửa các giá trị trong `new_row` rồi chạy lại ô này.'),
    code(
      'new_row = test.iloc[[0]][FEATURES].copy() if len(test) else train.iloc[[0]][FEATURES].copy()',
      'X_new = to_matrix(new_row)',
      'if X_train is X_train_scaled and NUMERIC:',
      '    X_new[NUMERIC] = scaler.transform(X_new[NUMERIC])',
      'prediction = model.predict(X_new)[0]',
      isClassification ? 'print(new_row.to_dict("records")[0], "→", CLASS_NAMES[int(prediction)])' : 'print(new_row.to_dict("records")[0], "→", round(float(prediction), 2))',
    ),
    markdown('## Em có thể thử tiếp', '', '- Đổi tham số (độ sâu cây, k, C) và chạy lại từ mục 3.', '- Thử mô hình khác của scikit-learn, ví dụ `RandomForestClassifier`.', '- Dùng `cross_val_score` để đánh giá trên nhiều cách chia khác nhau.'),
  ]);
}
