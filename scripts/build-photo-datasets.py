"""
Dựng các bộ ẢNH THẬT có giấy phép mở cho LUP Machine (chạy một lần khi cập nhật bộ dữ liệu, không chạy lúc build web).

Nguồn (tải về thủ công, xem public/datasets/README.md):
  tf_flowers  https://storage.googleapis.com/download.tensorflow.org/example_images/flower_photos.tgz
              CC BY 2.0, tác giả từng ảnh ghi trong flower_photos/LICENSE.txt
  ibean       https://huggingface.co/datasets/AI-Lab-Makerere/beans (data/train.zip, data/test.zip)
              MIT, (c) 2020 AIR Lab Makerere University

Hai bước:
  1) --sheets OUT   in bảng ảnh thu nhỏ của các ứng viên (đánh số) để DUYỆT BẰNG MẮT;
                    ảnh không phù hợp ghi vào "exclude" trong scripts/photo-datasets.json.
  2) --build        cắt vuông giữa, thu về 224×224, nén JPEG (bỏ EXIF), ghi public/datasets/<id>/
                    kèm manifest.json ghi nguồn + giấy phép TỪNG ẢNH.

Chọn ảnh tất định: sắp xếp tên tệp, xáo bằng seed cố định → chạy lại luôn ra cùng bộ ảnh.
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "scripts" / "photo-datasets.json"
OUT_ROOT = ROOT / "public" / "datasets"
SIZE = 224
JPEG_QUALITY = 85
SPARE = 20  # số ứng viên dự phòng mỗi lớp cho các ảnh bị loại khi duyệt
CHANGES = "Cắt vuông giữa, thu nhỏ về 224×224 điểm ảnh, nén JPEG, bỏ siêu dữ liệu EXIF."

CC_BY_2 = {"name": "CC BY 2.0", "url": "https://creativecommons.org/licenses/by/2.0/"}
MIT = {"name": "MIT", "url": "https://github.com/AI-Lab-Makerere/ibean/blob/master/LICENSE"}

# "daisy/x.jpg CC-BY by Tên - https://www.flickr.com/..."  hoặc  "daisy/x.jpg CC-BY https://... - by Tên"
CREDIT_A = re.compile(r"^(?P<file>\S+\.jpg) CC-BY by (?P<author>.+?) - (?P<url>https://www\.flickr\.com/\S+)$")
CREDIT_B = re.compile(r"^(?P<file>\S+\.jpg) CC-BY (?P<url>https://www\.flickr\.com/\S+) - by (?P<author>.+)$")


def flower_credits(source: Path) -> dict[str, dict[str, str]]:
    credits: dict[str, dict[str, str]] = {}
    for line in (source / "LICENSE.txt").read_text(encoding="utf8").splitlines():
        m = CREDIT_A.match(line.strip()) or CREDIT_B.match(line.strip())
        if m:
            credits[m["file"]] = {"author": " ".join(m["author"].split()), "url": m["url"]}
    return credits


def class_files(source: Path, folder: str, dataset: str) -> list[Path]:
    if dataset == "ibean":
        files = list((source / "train" / folder).glob("*.jpg")) + list((source / "test" / folder).glob("*.jpg"))
    else:
        files = list((source / folder).glob("*.jpg"))
    return sorted(files, key=lambda p: p.as_posix())


def candidates(source: Path, ds: dict) -> dict[str, list[Path]]:
    """Ứng viên mỗi lớp theo thứ tự đã xáo bằng seed (tất định)."""
    result = {}
    for c in ds["classes"]:
        files = class_files(source, c["folder"], ds["source"])
        random.Random(f"{ds['seed']}-{c['key']}").shuffle(files)
        result[c["key"]] = files[: ds["train"] + ds["test"] + SPARE]
    return result


def square_224(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    return im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def rel_name(path: Path, source: Path, dataset: str) -> str:
    return path.relative_to(source).as_posix()


def write_sheets(sources: dict[str, Path], out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    cfg = json.loads(CONFIG.read_text(encoding="utf8"))
    for ds in cfg["datasets"]:
        source = sources[ds["source"]]
        for key, files in candidates(source, ds).items():
            cols, thumb = 6, 160
            rows = (len(files) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * thumb, rows * (thumb + 16)), "white")
            draw = ImageDraw.Draw(sheet)
            for i, f in enumerate(files):
                x, y = (i % cols) * thumb, (i // cols) * (thumb + 16)
                sheet.paste(square_224(f).resize((thumb, thumb)), (x, y))
                draw.text((x + 2, y + thumb + 1), f"{i}: {f.name[:22]}", fill="black")
            sheet.save(out / f"{ds['id']}-{key}.jpg", quality=80)
            print(f"{ds['id']}-{key}: {len(files)} ứng viên")


def build(sources: dict[str, Path]) -> None:
    cfg = json.loads(CONFIG.read_text(encoding="utf8"))
    for ds in cfg["datasets"]:
        source = sources[ds["source"]]
        credits = flower_credits(source) if ds["source"] == "tf_flowers" else {}
        excluded = set(ds["exclude"])
        out = OUT_ROOT / ds["id"]
        images = []
        for key, files in candidates(source, ds).items():
            chosen = [f for f in files if rel_name(f, source, ds["source"]) not in excluded][: ds["train"] + ds["test"]]
            if len(chosen) < ds["train"] + ds["test"]:
                sys.exit(f"{ds['id']}/{key}: không đủ ảnh sau khi loại — tăng SPARE")
            (out / key).mkdir(parents=True, exist_ok=True)
            for i, f in enumerate(chosen):
                name = rel_name(f, source, ds["source"])
                target = f"{key}/{i + 1:02d}.jpg"
                square_224(f).save(out / target, "JPEG", quality=JPEG_QUALITY, optimize=True)
                if ds["source"] == "tf_flowers":
                    c = credits.get(name)
                    if not c:
                        sys.exit(f"Thiếu thông tin tác giả cho {name}")
                    credit = {"author": c["author"], "source": c["url"], "license": CC_BY_2["name"], "licenseUrl": CC_BY_2["url"]}
                else:
                    credit = {"author": "AIR Lab, Makerere University", "source": "https://github.com/AI-Lab-Makerere/ibean", "license": MIT["name"], "licenseUrl": MIT["url"]}
                images.append({
                    "file": target,
                    "class": key,
                    "split": "train" if i < ds["train"] else "test",
                    "original": name,
                    "credit": credit,
                })
        manifest = {
            "id": ds["id"],
            "version": 1,
            "size": SIZE,
            "changes": CHANGES,
            "classes": [c["key"] for c in ds["classes"]],
            "images": images,
        }
        (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
        if ds["source"] == "ibean":
            (out / "LICENSE.txt").write_text((source / "LICENSE").read_text(encoding="utf8"), encoding="utf8", newline="\n")
        total = sum((out / im["file"]).stat().st_size for im in images)
        print(f"{ds['id']}: {len(images)} ảnh, {total / 1024:.0f} KB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--flowers", type=Path, required=True, help="thư mục flower_photos (có LICENSE.txt)")
    parser.add_argument("--beans", type=Path, required=True, help="thư mục chứa train/ và test/ của ibean, cùng tệp LICENSE")
    parser.add_argument("--sheets", type=Path, help="in bảng ảnh thu nhỏ để duyệt vào thư mục này")
    parser.add_argument("--build", action="store_true", help="dựng public/datasets/")
    args = parser.parse_args()
    sources = {"tf_flowers": args.flowers, "ibean": args.beans}
    if args.sheets:
        write_sheets(sources, args.sheets)
    if args.build:
        build(sources)


if __name__ == "__main__":
    main()
