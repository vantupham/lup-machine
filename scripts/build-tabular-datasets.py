"""
Dựng các bộ dữ liệu bảng mẫu (CSV, tiêu đề cột tiếng Việt) cho Studio dữ liệu bảng.
Chạy: python scripts/build-tabular-datasets.py
Yêu cầu: scikit-learn (Iris có sẵn trong gói), mạng để tải Palmer Penguins.

- Iris (Fisher, 1936) – CC BY 4.0, UCI Machine Learning Repository, doi:10.24432/C56C76
- Palmer Penguins (Gorman, Williams & Fraser, 2014; Horst, Hill & Gorman, 2020) – CC0 1.0
  https://github.com/allisonhorst/palmerpenguins
Giá trị thiếu (NA) được giữ nguyên dưới dạng ô trống: đây là dữ liệu thật để học sinh tập xử lý.
"""
import csv
import io
import pathlib
import urllib.request

from sklearn.datasets import load_iris

OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "content" / "tabular"
PENGUINS_URL = "https://raw.githubusercontent.com/allisonhorst/palmerpenguins/main/inst/extdata/penguins.csv"


def write_csv(name: str, header: list[str], rows: list[list[str]]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    with path.open("w", encoding="utf-8", newline="\n") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)
    print(f"wrote {path} ({len(rows)} rows)")


def build_iris() -> None:
    iris = load_iris()
    header = ["Dài đài hoa (cm)", "Rộng đài hoa (cm)", "Dài cánh hoa (cm)", "Rộng cánh hoa (cm)", "Loài"]
    rows = [[f"{v:g}" for v in x] + [str(iris.target_names[y])] for x, y in zip(iris.data, iris.target)]
    write_csv("iris.csv", header, rows)


def build_penguins() -> None:
    with urllib.request.urlopen(PENGUINS_URL, timeout=30) as response:  # noqa: S310 (URL cố định)
        text = response.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    sex = {"male": "đực", "female": "cái", "NA": ""}
    header = ["Loài", "Đảo", "Dài mỏ (mm)", "Dày mỏ (mm)", "Dài cánh (mm)", "Cân nặng (g)", "Giới tính"]
    rows = []
    for r in reader:
        def val(key: str) -> str:
            return "" if r[key] == "NA" else r[key]
        rows.append([r["species"], r["island"], val("bill_length_mm"), val("bill_depth_mm"),
                     val("flipper_length_mm"), val("body_mass_g"), sex[r["sex"]]])
    write_csv("penguins.csv", header, rows)


if __name__ == "__main__":
    build_iris()
    build_penguins()
