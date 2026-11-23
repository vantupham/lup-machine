/**
 * Notebook Colab cho dự án âm thanh: chứa 160 đặc trưng ảnh phổ mel (dB) của mỗi đoạn, KHÔNG chứa âm thanh gốc.
 */
import { AUDIO } from '@/core/audio/features';
import { code, markdown, type Notebook } from './notebook';
import { PY_LEANING, vectorNotebook, type VectorNotebookInput } from './vector-notebook';

export type AudioNotebookInput = VectorNotebookInput;

export function audioNotebook(input: AudioNotebookInput): Notebook {
  const count = input.data.train.ys.length + input.data.test.ys.length;
  return vectorNotebook(input, {
    what: 'Notebook này dựng lại mô hình phân loại âm thanh của em.',
    dataNote: `${count} đoạn âm thanh 1 giây. Mỗi đoạn đã được biến thành ${AUDIO.nMels * AUDIO.timeSegments} con số: độ to trung bình (dB) của ${AUDIO.nMels} dải tần mel trong ${AUDIO.timeSegments} phần tư thời gian. Notebook **không chứa âm thanh gốc**.`,
    layoutNote: `Thứ tự 160 con số: \`x[đoạn * ${AUDIO.nMels} + dải]\` — đoạn 0–${AUDIO.timeSegments - 1} (thời gian), dải 0–${AUDIO.nMels - 1} (từ trầm tới bổng).`,
    logisticExtras: [
      markdown('## 4. Bản đồ vùng phổ quan trọng', '', 'Trọng số của mỗi lớp xếp lại thành lưới 40 dải × 4 đoạn: cam là ô càng to thì càng nghiêng về lớp đó, xanh là ngược lại.'),
      code(
        'import matplotlib.pyplot as plt',
        `N_MELS, N_SEGMENTS = ${AUDIO.nMels}, ${AUDIO.timeSegments}`,
        ...PY_LEANING,
        'fig, axes = plt.subplots(1, len(CLASS_NAMES), figsize=(3 * len(CLASS_NAMES), 4))',
        'for ax, name, w in zip(np.atleast_1d(axes), CLASS_NAMES, W):',
        '    grid = w.reshape(N_SEGMENTS, N_MELS).T',
        '    lim = np.abs(grid).max()',
        '    ax.imshow(grid, origin="lower", aspect="auto", cmap="coolwarm", vmin=-lim, vmax=lim)',
        '    ax.set_title(name); ax.set_xlabel("đoạn thời gian"); ax.set_ylabel("dải mel")',
        'plt.tight_layout()',
      ),
    ],
  });
}
