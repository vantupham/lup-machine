/**
 * Notebook Colab cho dự án tư thế: chứa tọa độ khớp đã chuẩn hóa, KHÔNG chứa ảnh.
 */
import { keypointNames, type PoseKind } from '@/core/pose/features';
import { code, markdown, pyList, type Notebook } from './notebook';
import { PY_LEANING, vectorNotebook, type VectorNotebookInput } from './vector-notebook';

export interface PoseNotebookInput extends VectorNotebookInput {
  readonly kind: PoseKind;
}

export function poseNotebook(input: PoseNotebookInput): Notebook {
  const names = keypointNames(input.kind);
  const count = input.data.train.ys.length + input.data.test.ys.length;
  const unit = input.kind === 'body' ? 'gốc ở giữa hai hông, đơn vị = chiều dài thân' : 'gốc ở cổ tay, đơn vị = khoảng cách cổ tay → gốc ngón giữa';
  return vectorNotebook(input, {
    what: `Notebook này dựng lại mô hình nhận dạng ${input.kind === 'body' ? 'tư thế cơ thể' : 'cử chỉ bàn tay'} của em.`,
    dataNote: `${count} mẫu, mỗi mẫu là tọa độ (x, y) của ${names.length} khớp (${unit}). Notebook **không chứa ảnh**.`,
    layoutNote: `Thứ tự: \`[x0, y0, x1, y1, …]\` theo các khớp trong \`JOINTS\` ở ô dưới; trục y hướng xuống như ảnh; khớp mô hình không thấy rõ được đặt về 0.`,
    logisticExtras: [
      markdown('## 4. Khớp nào quan trọng?', '', 'Độ quan trọng của một khớp = |trọng số của x| + |trọng số của y| (trên đặc trưng đã chuẩn hóa).'),
      code(
        'import matplotlib.pyplot as plt',
        `JOINTS = ${pyList(names)}`,
        ...PY_LEANING,
        'importance = np.abs(W).reshape(len(CLASS_NAMES), -1, 2).sum(axis=2)',
        'pd.DataFrame(importance.T, index=JOINTS, columns=CLASS_NAMES).round(3).plot.barh(figsize=(6, 0.3 * len(JOINTS) + 1))',
        'plt.gca().invert_yaxis(); plt.tight_layout()',
      ),
    ],
  });
}
