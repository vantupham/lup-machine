"""Chạy đúng chương trình Python hiển thị ở khung "Mã Python" (bước Huấn luyện của Studio ảnh)
trên một bộ dữ liệu nhỏ cố định, rồi ghi kết quả để Vitest so với vết chạy của trình duyệt.

Cách chạy (cần numpy):
    python scripts/gen-trace-reference.py
"""

import contextlib
import io
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PYTHON_DIR = ROOT / "src" / "core" / "trace" / "python"
OUT = ROOT / "src" / "core" / "trace" / "softmax-trace.reference.json"

N, DIM, NUM_CLASSES = 11, 4, 3
OPTIONS = {"epochs": 6, "learningRate": 0.05, "batchSize": 4, "seed": 7}


def fixture() -> tuple[np.ndarray, np.ndarray]:
    """Dữ liệu tất định: mỗi lớp lệch về một chiều, cộng thêm nhiễu theo công thức sin."""
    ys = np.array([i % NUM_CLASSES for i in range(N)], dtype=np.int64)
    xs = np.array(
        [[np.sin(i * 1.7 + j * 0.9) * 0.5 + (1.0 if j == ys[i] else 0.0) for j in range(DIM)] for i in range(N)],
        dtype=np.float32,
    )
    return xs, ys


def main() -> None:
    xs, ys = fixture()
    sys.path.insert(0, str(PYTHON_DIR))
    source = (PYTHON_DIR / "softmax_train.py").read_text(encoding="utf-8")
    namespace = {
        # Trình duyệt giữ vector dạng float32 nhưng tính bằng float64: đưa vào numpy y như vậy.
        "X_train": xs.astype(np.float64),
        "y_train": ys,
        "NUM_CLASSES": NUM_CLASSES,
        "EPOCHS": OPTIONS["epochs"],
        "LEARNING_RATE": OPTIONS["learningRate"],
        "BATCH_SIZE": OPTIONS["batchSize"],
        "SEED": OPTIONS["seed"],
    }
    printed = io.StringIO()
    with contextlib.redirect_stdout(printed):
        exec(compile(source, "softmax_train.py", "exec"), namespace)  # noqa: S102 - mã của chính dự án

    reference = {
        "input": {"xs": xs.tolist(), "ys": ys.tolist(), "options": OPTIONS},
        "output": printed.getvalue().splitlines(),
        "final": {
            "weights": namespace["W"].astype(np.float64).ravel().tolist(),
            "bias": namespace["b"].astype(np.float64).tolist(),
            "lastBatchLoss": float(namespace["loss"]),
        },
    }
    OUT.write_text(json.dumps(reference, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    sys.stdout.write(f"Đã ghi {OUT.relative_to(ROOT)}\n")


if __name__ == "__main__":
    main()
