"""
Sinh kết quả tham chiếu từ scikit-learn / NumPy để kiểm thử đối chiếu các thuật toán tự cài đặt.
Chạy: python scripts/gen-reference-results.py
Yêu cầu: numpy, scikit-learn
"""
import json
import pathlib

import numpy as np
import sklearn
from sklearn.decomposition import PCA

OUT = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)


def pca_reference() -> dict:
    rng = np.random.default_rng(20261122)
    # 3 cụm trong không gian 12 chiều, phương sai khác nhau theo từng trục
    centers = rng.normal(0, 4, size=(3, 12))
    scales = np.linspace(3.0, 0.2, 12)
    raw = np.vstack([c + rng.normal(0, 1, size=(20, 12)) * scales for c in centers])
    x = np.round(raw, 6)  # làm tròn TRƯỚC khi tính, để tệp tham chiếu khớp đúng dữ liệu đã ghi
    pca = PCA(n_components=2, svd_solver="full").fit(x)
    return {
        "generator": f"scikit-learn {sklearn.__version__}, numpy {np.__version__}",
        "x": x.tolist(),
        "mean": pca.mean_.tolist(),
        "components": pca.components_.tolist(),
        "explainedVarianceRatio": pca.explained_variance_ratio_.tolist(),
        "projected": pca.transform(x).tolist(),
    }


if __name__ == "__main__":
    path = OUT / "pca-reference.json"
    path.write_text(json.dumps(pca_reference(), indent=1), encoding="utf-8")
    print(f"wrote {path}")
