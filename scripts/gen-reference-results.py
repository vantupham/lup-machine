"""
Sinh kết quả tham chiếu từ scikit-learn / NumPy để kiểm thử đối chiếu các thuật toán tự cài đặt.
Chạy: python scripts/gen-reference-results.py
Yêu cầu: numpy, scikit-learn

Quy ước: dữ liệu được làm tròn TRƯỚC khi tính, để tệp tham chiếu khớp đúng dữ liệu đã ghi.
"""
import json
import pathlib

import numpy as np
import sklearn
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.neural_network import MLPClassifier
from sklearn.tree import DecisionTreeClassifier

OUT = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)
GENERATOR = f"scikit-learn {sklearn.__version__}, numpy {np.__version__}"


def blobs(rng: np.random.Generator, centers: np.ndarray, per_class: int, spread: float) -> tuple[np.ndarray, np.ndarray]:
    xs = np.vstack([c + rng.normal(0, spread, size=(per_class, centers.shape[1])) for c in centers])
    ys = np.repeat(np.arange(len(centers)), per_class)
    return np.round(xs, 6), ys


def pca_reference() -> dict:
    rng = np.random.default_rng(20261122)
    # 3 cụm trong không gian 12 chiều, phương sai khác nhau theo từng trục
    centers = rng.normal(0, 4, size=(3, 12))
    scales = np.linspace(3.0, 0.2, 12)
    raw = np.vstack([c + rng.normal(0, 1, size=(20, 12)) * scales for c in centers])
    x = np.round(raw, 6)
    pca = PCA(n_components=2, svd_solver="full").fit(x)
    return {
        "generator": GENERATOR,
        "x": x.tolist(),
        "mean": pca.mean_.tolist(),
        "components": pca.components_.tolist(),
        "explainedVarianceRatio": pca.explained_variance_ratio_.tolist(),
        "projected": pca.transform(x).tolist(),
    }


def knn_reference() -> dict:
    rng = np.random.default_rng(20261123)
    x, y = blobs(rng, np.array([[-1.0, -0.5], [1.0, -0.4], [0.0, 1.0]]), 20, 0.7)
    queries = np.round(rng.uniform(-2, 2, size=(40, 2)), 6)
    cases = []
    for k in (1, 3, 7, 15):
        clf = KNeighborsClassifier(n_neighbors=k, algorithm="brute").fit(x, y)
        dist, idx = clf.kneighbors(queries)
        cases.append({
            "k": k,
            "predictions": clf.predict(queries).tolist(),
            "neighbors": idx.tolist(),
            "distances": dist.tolist(),
        })
    targets = np.round(x[:, 0] * 2 - x[:, 1] + rng.normal(0, 0.3, size=len(x)), 6)
    regression = []
    for k in (1, 5):
        reg = KNeighborsRegressor(n_neighbors=k, algorithm="brute").fit(x, targets)
        regression.append({"k": k, "predictions": reg.predict(queries).tolist()})
    return {
        "generator": GENERATOR, "x": x.tolist(), "y": y.tolist(), "queries": queries.tolist(), "cases": cases,
        "targets": targets.tolist(), "regression": regression,
    }


def tree_reference() -> dict:
    rng = np.random.default_rng(20261124)
    centers = np.array([[0.0, 0.0, 0.0, 0.0], [1.5, 1.0, -0.5, 0.3], [0.5, 2.0, 1.0, -1.0]])
    x, y = blobs(rng, centers, 40, 0.9)
    queries = np.round(rng.uniform(-2, 3, size=(50, 4)), 6)
    cases = []
    for criterion, depth in (("gini", 3), ("entropy", 3), ("gini", 2)):
        clf = DecisionTreeClassifier(criterion=criterion, max_depth=depth, random_state=0).fit(x, y)
        t = clf.tree_
        cases.append({
            "criterion": criterion,
            "maxDepth": depth,
            "feature": t.feature.tolist(),
            "threshold": t.threshold.tolist(),
            "childrenLeft": t.children_left.tolist(),
            "childrenRight": t.children_right.tolist(),
            "samples": t.n_node_samples.tolist(),
            "impurity": t.impurity.tolist(),
            "featureImportances": clf.feature_importances_.tolist(),
            "predictions": clf.predict(queries).tolist(),
            "trainAccuracy": float(clf.score(x, y)),
        })
    return {"generator": GENERATOR, "x": x.tolist(), "y": y.tolist(), "queries": queries.tolist(), "cases": cases}


def linreg_reference() -> dict:
    rng = np.random.default_rng(20261125)
    x = np.round(rng.normal(0, 2, size=(60, 3)), 6)
    true_w = np.array([1.7, -0.6, 0.25])
    y = np.round(x @ true_w + 4.2 + rng.normal(0, 0.8, size=60), 6)
    model = LinearRegression().fit(x, y)
    pred = model.predict(x)
    x1 = x[:, :1]
    m1 = LinearRegression().fit(x1, y)
    return {
        "generator": GENERATOR,
        "x": x.tolist(),
        "y": y.tolist(),
        "coef": model.coef_.tolist(),
        "intercept": float(model.intercept_),
        "mse": float(mean_squared_error(y, pred)),
        "r2": float(r2_score(y, pred)),
        "simpleCoef": float(m1.coef_[0]),
        "simpleIntercept": float(m1.intercept_),
    }


def logistic_case(x: np.ndarray, y: np.ndarray, c: float) -> dict:
    clf = LogisticRegression(C=c, tol=1e-12, max_iter=100000).fit(x, y)
    return {
        "C": c,
        "coef": clf.coef_.tolist(),
        "intercept": clf.intercept_.tolist(),
        "proba": clf.predict_proba(x).tolist(),
    }


def logistic_reference() -> dict:
    rng = np.random.default_rng(20261128)
    x3, y3 = blobs(rng, np.array([[0.0, 0.0, 0.0], [1.5, 0.5, -1.0], [-0.5, 1.8, 0.7]]), 25, 1.0)
    x2, y2 = blobs(rng, np.array([[0.0, 0.0], [1.2, 0.8]]), 30, 0.9)
    return {
        "generator": GENERATOR,
        "multiclass": {"x": x3.tolist(), "y": y3.tolist(), "cases": [logistic_case(x3, y3, 1.0), logistic_case(x3, y3, 0.1)]},
        "binary": {"x": x2.tolist(), "y": y2.tolist(), "cases": [logistic_case(x2, y2, 1.0), logistic_case(x2, y2, 0.05)]},
    }


TEXT_DOCS = [
    "Hôm nay trời nắng đẹp, em đi học sớm.",
    "Trời mưa to, đường ngập nước!",
    "Đội bóng của lớp em thắng 2-1.",
    "Cầu thủ ghi bàn ở phút cuối, cả sân reo hò.",
    "Bát phở bò nóng hổi, thơm mùi quế hồi.",
    "Mẹ nấu canh chua cá lóc rất ngon.",
    "Gió mùa đông bắc tràn về, trời rét đậm.",
    "Em thích đá bóng và bơi lội vào cuối tuần.",
    "Bánh mì Việt Nam nổi tiếng khắp thế giới.",
    "Ngày mai có mưa rào và dông ở vài nơi.",
    "Trận chung kết diễn ra lúc 19 giờ tối nay.",
    "Chè đậu xanh mát lạnh ngày hè.",
]
TEXT_LABELS = [0, 0, 1, 1, 2, 2, 0, 1, 2, 0, 1, 2]
TEXT_QUERIES = ["Trời hôm nay mưa và có gió.", "Em ăn phở và đá bóng.", "Một câu hoàn toàn mới lạ."]
TOKEN_PATTERN = r"(?u)\b\w+\b"  # giữ cả âm tiết 1 chữ cái (ở, à, ý…)


def text_reference() -> dict:
    cases = []
    for ngram in (1, 2):
        tfidf = TfidfVectorizer(token_pattern=TOKEN_PATTERN, ngram_range=(1, ngram)).fit(TEXT_DOCS)
        count = CountVectorizer(token_pattern=TOKEN_PATTERN, ngram_range=(1, ngram)).fit(TEXT_DOCS)
        counts = count.transform(TEXT_DOCS)
        nb = MultinomialNB(alpha=1.0).fit(counts, TEXT_LABELS)
        q_counts = count.transform(TEXT_QUERIES)
        x_tfidf = tfidf.transform(TEXT_DOCS)
        logistic = LogisticRegression(C=10.0, tol=1e-12, max_iter=100000).fit(x_tfidf, TEXT_LABELS)
        cases.append({
            "ngram": ngram,
            "vocabulary": tfidf.get_feature_names_out().tolist(),
            "idf": tfidf.idf_.tolist(),
            "tfidf": x_tfidf.toarray().tolist(),
            "queryTfidf": tfidf.transform(TEXT_QUERIES).toarray().tolist(),
            "nbClassLogPrior": nb.class_log_prior_.tolist(),
            "nbFeatureLogProb": nb.feature_log_prob_.tolist(),
            "nbQueryProba": nb.predict_proba(q_counts).tolist(),
            "logisticCoef": logistic.coef_.tolist(),
            "logisticIntercept": logistic.intercept_.tolist(),
            "logisticQueryProba": logistic.predict_proba(tfidf.transform(TEXT_QUERIES)).tolist(),
        })
    return {"generator": GENERATOR, "docs": TEXT_DOCS, "labels": TEXT_LABELS, "queries": TEXT_QUERIES, "cases": cases}


def kmeans_reference() -> dict:
    rng = np.random.default_rng(20261126)
    x, _ = blobs(rng, np.array([[-2.0, -1.0], [2.0, -1.5], [0.0, 2.0], [2.5, 2.5]]), 25, 0.6)
    init = np.round(rng.uniform(-3, 3, size=(4, 2)), 6)
    km = KMeans(n_clusters=4, init=init, n_init=1, algorithm="lloyd", tol=0, max_iter=100).fit(x)
    return {
        "generator": GENERATOR,
        "x": x.tolist(),
        "init": init.tolist(),
        "centers": km.cluster_centers_.tolist(),
        "labels": km.labels_.tolist(),
        "inertia": float(km.inertia_),
        "nIter": int(km.n_iter_),
    }


def mlp_case(x: np.ndarray, y: np.ndarray, hidden: tuple[int, ...], activation: str, lr: float, seed: int) -> dict:
    rng = np.random.default_rng(seed)
    sizes = [x.shape[1], *hidden, int(y.max()) + 1]
    coefs = [np.round(rng.uniform(-0.8, 0.8, size=(a, b)), 6) for a, b in zip(sizes[:-1], sizes[1:])]
    intercepts = [np.round(rng.uniform(-0.3, 0.3, size=b), 6) for b in sizes[1:]]

    clf = MLPClassifier(hidden_layer_sizes=hidden, activation=activation, solver="sgd", alpha=0.0,
                        batch_size=len(x), learning_rate="constant", learning_rate_init=lr, momentum=0.0,
                        nesterovs_momentum=False, shuffle=False, max_iter=1, random_state=0)
    clf.fit(x, y)  # chỉ để sklearn dựng cấu trúc; trọng số được thay ngay bên dưới
    clf.coefs_ = [c.copy() for c in coefs]
    clf.intercepts_ = [b.copy() for b in intercepts]
    proba_before = clf.predict_proba(x)
    del clf._optimizer
    clf.partial_fit(x, y)  # đúng MỘT bước gradient descent trên toàn bộ dữ liệu
    return {
        "hidden": list(hidden),
        "activation": activation,
        "learningRate": lr,
        "initCoefs": [c.tolist() for c in coefs],
        "initIntercepts": [b.tolist() for b in intercepts],
        "probaBefore": proba_before.tolist(),
        "coefsAfter": [c.tolist() for c in clf.coefs_],
        "interceptsAfter": [b.tolist() for b in clf.intercepts_],
    }


def mlp_reference() -> dict:
    rng = np.random.default_rng(20261127)
    x, y = blobs(rng, np.array([[-1.0, 0.0], [1.0, 0.0], [0.0, 1.2]]), 10, 0.5)
    return {
        "generator": GENERATOR,
        "x": x.tolist(),
        "y": y.tolist(),
        "cases": [
            mlp_case(x, y, (5,), "tanh", 0.5, 1),
            mlp_case(x, y, (4, 3), "relu", 0.3, 2),
            mlp_case(x, y, (3,), "logistic", 1.0, 3),
        ],
    }


REFERENCES = {
    "pca-reference.json": pca_reference,
    "knn-reference.json": knn_reference,
    "tree-reference.json": tree_reference,
    "linreg-reference.json": linreg_reference,
    "logistic-reference.json": logistic_reference,
    "text-reference.json": text_reference,
    "kmeans-reference.json": kmeans_reference,
    "mlp-reference.json": mlp_reference,
}

if __name__ == "__main__":
    for name, build in REFERENCES.items():
        path = OUT / name
        path.write_text(json.dumps(build(), indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"wrote {path}")
