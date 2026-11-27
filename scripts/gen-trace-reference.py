"""Chạy đúng các chương trình Python hiển thị ở khung "Mã Python" của Studio ảnh trên dữ liệu nhỏ cố định,
rồi ghi kết quả để Vitest so với vết chạy của trình duyệt (src/core/trace/*.reference.json).

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
TRACE_DIR = ROOT / "src" / "core" / "trace"
PYTHON_DIR = TRACE_DIR / "python"

sys.path.insert(0, str(PYTHON_DIR))
import lup_helpers  # noqa: E402 - cần sys.path ở trên


def run(program: str, namespace: dict) -> tuple[list[str], dict]:
    """Chạy một file .py trong `namespace`, trả về các dòng in ra và namespace sau khi chạy."""
    source = (PYTHON_DIR / program).read_text(encoding="utf-8")
    printed = io.StringIO()
    with contextlib.redirect_stdout(printed):
        exec(compile(source, program, "exec"), namespace)  # noqa: S102 - mã của chính dự án
    return printed.getvalue().splitlines(), namespace


def write(name: str, data: dict) -> None:
    out = TRACE_DIR / name
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    sys.stdout.write(f"Đã ghi {out.relative_to(ROOT)}\n")


def softmax_reference() -> None:
    n, dim, num_classes = 11, 4, 3
    options = {"epochs": 6, "learningRate": 0.05, "batchSize": 4, "seed": 7}
    ys = np.array([i % num_classes for i in range(n)], dtype=np.int64)
    xs = np.array(
        [[np.sin(i * 1.7 + j * 0.9) * 0.5 + (1.0 if j == ys[i] else 0.0) for j in range(dim)] for i in range(n)],
        dtype=np.float32,
    )
    output, ns = run(
        "softmax_train.py",
        {
            # Trình duyệt giữ vector dạng float32 nhưng tính bằng float64: đưa vào numpy y như vậy.
            "X_train": xs.astype(np.float64),
            "y_train": ys,
            "NUM_CLASSES": num_classes,
            "EPOCHS": options["epochs"],
            "LEARNING_RATE": options["learningRate"],
            "BATCH_SIZE": options["batchSize"],
            "SEED": options["seed"],
        },
    )
    write(
        "softmax-trace.reference.json",
        {
            "input": {"xs": xs.tolist(), "ys": ys.tolist(), "options": options},
            "output": output,
            "final": {
                "weights": ns["W"].astype(np.float64).ravel().tolist(),
                "bias": ns["b"].astype(np.float64).tolist(),
                "lastBatchLoss": float(ns["loss"]),
            },
        },
    )


def fixture_image(size: int, background: int, square: tuple[int, int, int, int]) -> np.ndarray:
    """Ảnh vuông nền đều, có một hình vuông sáng khác nền; kênh màu lệch nhau để ảnh không xám sẵn."""
    gray = np.full((size, size), background, dtype=np.float64)
    x, y, side, value = square
    gray[y : y + side, x : x + side] = value
    rgb = np.stack([gray, gray * 0.9 + 10, gray * 0.8 + 5], axis=-1)
    return np.clip(np.round(rgb), 0, 255).astype(np.uint8)


def data_check_reference() -> None:
    size = 32  # chia hết cho 16 (dấu vân tay) và viền 32 // 14 = 2 điểm
    specs = [
        (0, "train", 200, (4, 4, 10, 120)),
        (0, "train", 210, (12, 8, 12, 100)),
        (1, "train", 30, (6, 14, 8, 150)),
        (1, "train", 45, (16, 4, 10, 170)),
        (0, "test", 40, (10, 10, 10, 160)),
    ]
    images = [fixture_image(size, bg, sq) for _, _, bg, sq in specs]
    labels = [label for label, *_ in specs]
    splits = [split for _, split, *_ in specs]
    # Ảnh Kiểm tra chụp lại từ ảnh Huấn luyện số 0 (sáng hơn một chút): "lộ đề".
    images.append(np.clip(images[0].astype(np.int64) + 3, 0, 255).astype(np.uint8))
    labels.append(0)
    splits.append("test")
    # Hai ảnh gần như một màu: dấu vân tay chỉ là nhiễu, phải bị bỏ qua dù "trùng".
    for background in (100, 101):
        images.append(fixture_image(size, background, (0, 0, 1, background + 2)))
        labels.append(1)
        splits.append("test")
    output, _ = run(
        "data_check.py",
        {"images": images, "labels": labels, "splits": splits, "CLASS_NAMES": ["Tròn", "Vuông"], "MAX_DIFF": 16, "MIN_CONTRAST": 8},
    )
    write(
        "data-check.reference.json",
        {
            "input": {"size": size, "rgb": [img.ravel().tolist() for img in images], "labels": labels, "splits": splits},
            "output": output,
            "borders": [lup_helpers.border_brightness(lup_helpers.luminance(img)) for img in images],
            "hashes": [lup_helpers.average_hash(lup_helpers.luminance(img)).astype(int).tolist() for img in images],
            "contrasts": [lup_helpers.block_contrast(lup_helpers.luminance(img)) for img in images],
        },
    )


def represent_reference() -> None:
    dim = 5
    features = np.array([[np.sin(k * 1.3 + j * 0.7) + 1.2 for j in range(dim)] for k in range(6)], dtype=np.float32)
    splits = ["train", "train", "test", "train", "train", "test"]
    original = lup_helpers.mobilenet_v2
    lup_helpers.mobilenet_v2 = lambda images: features.astype(np.float64)  # thay MobileNet bằng vector cố định
    try:
        output, _ = run("represent.py", {"images": [None] * len(features), "splits": splits, "i": 2})
    finally:
        lup_helpers.mobilenet_v2 = original
    write("represent.reference.json", {"input": {"features": features.tolist(), "splits": splits, "index": 2}, "output": output})


def model_fixture() -> tuple[np.ndarray, np.ndarray]:
    """Mô hình nhỏ cố định: 3 lớp, 4 chiều (float32 như trình duyệt)."""
    weights = np.array([[np.cos(k * 2.1 + j * 0.8) for j in range(4)] for k in range(3)], dtype=np.float32)
    bias = np.array([0.1, -0.2, 0.05], dtype=np.float32)
    return weights, bias


def evaluate_reference() -> None:
    weights, bias = model_fixture()
    xs = np.array([[np.sin(i * 0.9 + j * 1.4) * 2 for j in range(4)] for i in range(9)], dtype=np.float32)
    ys = np.array([0, 1, 0, 1, 0, 1, 1, 0, 1], dtype=np.int64)  # lớp 2 không có ảnh: phải bỏ qua
    output, _ = run(
        "evaluate.py",
        {"X": xs.astype(np.float64), "y": ys, "W": weights.astype(np.float64), "b": bias.astype(np.float64), "CLASS_NAMES": ["A", "B", "C"]},
    )
    write(
        "evaluate.reference.json",
        {"input": {"xs": xs.tolist(), "ys": ys.tolist(), "weights": weights.tolist(), "bias": bias.tolist()}, "output": output},
    )


def predict_reference() -> None:
    weights, bias = model_fixture()
    cases = []
    for vector in ([1.5, -0.3, 0.8, 0.2], [0.05, 0.02, -0.04, 0.01]):  # một ảnh chắc chắn, một ảnh "chưa chắc"
        x = np.array(vector, dtype=np.float32)
        original = lup_helpers.mobilenet_v2
        lup_helpers.mobilenet_v2 = lambda images, x=x: x.astype(np.float64)[None]
        try:
            output, _ = run(
                "predict.py",
                {"image": np.zeros((1, 1, 3)), "W": weights.astype(np.float64), "b": bias.astype(np.float64), "CLASS_NAMES": ["A", "B", "C"], "UNCERTAIN_BELOW": 0.6},
            )
        finally:
            lup_helpers.mobilenet_v2 = original
        cases.append({"vector": x.tolist(), "output": output})
    write("predict.reference.json", {"weights": weights.tolist(), "bias": bias.tolist(), "cases": cases})


def text_reference() -> None:
    """Studio văn bản: TF-IDF một câu, huấn luyện Naive Bayes, đoán một câu (cùng bộ câu mẫu)."""
    sentences = [
        "Món ăn rất ngon",
        "Cơm ngon, giá rẻ",
        "Phục vụ chậm quá",
        "Đồ ăn nguội và dở",
        "Nhân viên vui vẻ, món ngon",
        "Chờ lâu, đồ ăn dở",
    ]
    ys = [1, 1, 0, 0, 1, 0]
    class_names = ["chê", "khen"]
    max_n = 2
    docs = [lup_helpers.text_terms(t, max_n) for t in sentences]
    vocab = sorted({term for doc in docs for term in doc})
    df = [sum(term in doc for doc in docs) for term in vocab]
    counts = np.array([[doc.count(term) for term in vocab] for doc in docs])
    probe = "Món ngon nhưng chờ lâu quá"

    vectorize_out, _ = run("text_vectorize.py", {"sentence": probe, "MAX_N": max_n, "vocab": vocab, "df": df, "N": len(sentences)})
    nb_out, nb = run("naive_bayes.py", {"X": counts, "y": np.array(ys), "VOCAB": vocab, "CLASS_NAMES": class_names, "ALPHA": 1.0})
    predict_out, _ = run(
        "text_predict.py",
        {"sentence": probe, "MAX_N": max_n, "vocab": vocab, "log_prior": nb["log_prior"], "log_prob": nb["log_prob"], "CLASS_NAMES": class_names},
    )
    write(
        "text.reference.json",
        {
            "input": {"sentences": sentences, "ys": ys, "classNames": class_names, "maxN": max_n, "probe": probe, "alpha": 1.0},
            "vocab": vocab,
            "logPrior": nb["log_prior"].tolist(),
            "logProb": nb["log_prob"].tolist(),
            "vectorize": vectorize_out,
            "naiveBayes": nb_out,
            "predict": predict_out,
        },
    )


def tabular_reference() -> None:
    """Studio bảng số: chuẩn hóa, và dự đoán một dòng bằng cây quyết định, k-NN, hồi quy tuyến tính."""
    columns = ["Chiều dài", "Cân nặng", "Không đổi"]
    rows = np.array([[39.1, 3750, 5], [46.5, 4200, 5], [50.0, 5400, 5], [36.7, 3450, 5], [45.2, 4800, 5]], dtype=np.float64)
    scale_out, _ = run("tabular_scale.py", {"X": rows.copy(), "COLUMNS": columns})

    tree = [
        {"split": {"feature": 0, "threshold": 42.35, "left": 1, "right": 2}, "counts": [2, 2, 1]},
        {"split": None, "counts": [2, 0, 0]},
        {"split": {"feature": 1, "threshold": 4500.0, "left": 3, "right": 4}, "counts": [0, 2, 1]},
        {"split": None, "counts": [0, 2, 0]},
        {"split": None, "counts": [0, 0, 1]},
    ]
    features = ["Chiều dài", "Cân nặng"]
    classes = ["Adelie", "Chinstrap", "Gentoo"]
    x_tree = [46.5, 4200.0]
    tree_out, _ = run("tree_predict.py", {"x": x_tree, "tree": tree, "FEATURES": features, "CLASS_NAMES": classes})

    x_train = np.array([[0.1, -0.5], [1.2, 0.3], [-0.7, 0.9], [0.4, 0.4], [-1.1, -1.0], [0.0, 0.2]])
    labels = np.array([0, 1, 2, 1, 0, 2])
    values = np.array([3.5, 4.25, 5.0, 4.0, 3.25, 4.75])
    x_knn = np.array([0.2, 0.1])
    rows_knn = [3, 5, 8, 9, 12, 14]
    knn_cls, _ = run("knn_predict.py", {"x": x_knn, "X_train": x_train, "y_train": labels, "K": 3, "ROWS": rows_knn, "TASK": "classification", "CLASS_NAMES": classes})
    knn_reg, _ = run("knn_predict.py", {"x": x_knn, "X_train": x_train, "y_train": values, "K": 3, "ROWS": rows_knn, "TASK": "regression", "CLASS_NAMES": []})

    w, b, x_lin = [0.125, -2.5, 30.0], 1.75, [12.0, 0.4, 0.0]
    linear_out, _ = run("linear_predict.py", {"x": x_lin, "w": w, "b": b, "FEATURES": columns})
    write(
        "tabular.reference.json",
        {
            "scale": {"rows": rows.tolist(), "columns": columns, "output": scale_out},
            "tree": {"nodes": tree, "x": x_tree, "features": features, "classNames": classes, "output": tree_out},
            "knn": {
                "train": x_train.tolist(),
                "labels": labels.tolist(),
                "values": values.tolist(),
                "x": x_knn.tolist(),
                "rows": rows_knn,
                "classification": knn_cls,
                "regression": knn_reg,
            },
            "linear": {"w": w, "b": b, "x": x_lin, "features": columns, "output": linear_out},
        },
    )


def main() -> None:
    softmax_reference()
    data_check_reference()
    represent_reference()
    evaluate_reference()
    predict_reference()
    text_reference()
    tabular_reference()


if __name__ == "__main__":
    main()
