"""
Chạy thật mọi ô mã trong các notebook do LUP Machine xuất ra, để chắc chắn notebook chạy được trên Colab.
Chạy:
  1. NOTEBOOK_DIR=<thư mục> npx vitest run src/core/export   (ghi các notebook mẫu ra thư mục)
  2. python scripts/check-notebooks.py <thư mục>
Yêu cầu: numpy, pandas, scikit-learn; notebook ảnh cần thêm tensorflow (có keras 3).
Thoát với mã 1 nếu một ô bị lỗi hoặc kết quả của notebook dữ liệu bảng "lệch" so với LUP Machine.
Riêng k-NN được phép lệch: khi nhiều dòng cách đều nhau, scikit-learn chọn láng giềng theo thứ tự khác
(notebook đã giải thích điều này cho học sinh).
"""
import contextlib
import io
import json
import os
import pathlib
import sys
import tempfile
import traceback


MISMATCH = "→ lệch"


def run_notebook(path: pathlib.Path) -> tuple[bool, str]:
    cells = json.loads(path.read_text(encoding="utf-8"))["cells"]
    tie_tolerant = any("KNeighbors" in "".join(c["source"]) for c in cells)
    namespace: dict = {"__name__": "__main__"}
    out = io.StringIO()
    with tempfile.TemporaryDirectory() as work, contextlib.redirect_stdout(out):
        cwd = os.getcwd()
        os.chdir(work)
        try:
            for i, cell in enumerate(c for c in cells if c["cell_type"] == "code"):
                source = "".join(cell["source"])
                try:
                    exec(compile(source, f"{path.name}[ô {i + 1}]", "exec"), namespace)
                except Exception:  # noqa: BLE001 — báo mọi lỗi của ô
                    return False, out.getvalue() + traceback.format_exc()
        finally:
            os.chdir(cwd)
    text = out.getvalue()
    return tie_tolerant or MISMATCH not in text, text


def main() -> int:
    folder = pathlib.Path(sys.argv[1])
    failed = 0
    for path in sorted(folder.glob("*.ipynb")):
        ok, text = run_notebook(path)
        print(f"{'ĐẠT' if ok else 'LỖI'} {path.name}")
        for line in text.splitlines():
            if any(key in line for key in ("accuracy", "_r2", "_mse", "Chênh lệch", "tflite", "Huấn luyện:")):
                print("   ", line)
        if not ok:
            failed += 1
            print(text)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
