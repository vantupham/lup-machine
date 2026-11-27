"""Tóm tắt MobileNetV2 (public/models/mobilenet-v2-035/model.json) theo từng khối cho sơ đồ mạng ở bước 4.

Mọi con số (kích thước đầu ra, số kênh, số tham số, số tầng mỗi loại) đọc thẳng từ tệp mô hình mà trang tải,
không chép tay. Chạy lại khi đổi mô hình:
    python scripts/build-network-summary.py
"""

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "public" / "models" / "mobilenet-v2-035" / "model.json"
OUT = ROOT / "src" / "core" / "ml" / "mobilenet-summary.json"
INPUT_SIZE = 224
# Trọng số không học bằng gradient (chỉ đếm thống kê của BatchNormalization).
NON_TRAINABLE = ("moving_mean", "moving_variance")


def block_of(layer_name: str) -> str:
    """Tên khối của một tầng: Conv1 (đầu mạng), block_0 … block_16, Conv_1 (cuối mạng)."""
    if layer_name in ("Conv1", "Conv1_pad", "bn_Conv1", "Conv1_relu"):
        return "Conv1"
    if layer_name.startswith("expanded_conv"):
        return "block_0"
    match = re.match(r"block_(\d+)_", layer_name)
    if match:
        return f"block_{match.group(1)}"
    if layer_name in ("Conv_1", "Conv_1_bn", "out_relu"):
        return "Conv_1"
    raise ValueError(f"Không biết tầng {layer_name} thuộc khối nào")


def main() -> None:
    model = json.loads(MODEL.read_text(encoding="utf-8"))
    layers = model["modelTopology"]["model_config"]["config"]["layers"]
    blocks: dict[str, dict] = {}
    size, channels = INPUT_SIZE, 3
    for layer in layers:
        kind, config = layer["class_name"], layer["config"]
        if kind == "InputLayer":
            continue
        block = blocks.setdefault(block_of(config["name"]), {"layers": {}, "names": [], "params": 0, "frozenStats": 0})
        block["layers"][kind] = block["layers"].get(kind, 0) + 1
        block["names"].append(config["name"])
        if kind in ("Conv2D", "DepthwiseConv2D") and config.get("strides") == [2, 2]:
            size = math.ceil(size / 2)
        if kind == "Conv2D":
            channels = config["filters"]
        block["outShape"] = [size, size, channels]

    for group in model["weightsManifest"]:
        for weight in group["weights"]:
            count = math.prod(weight["shape"])
            block = blocks[block_of(weight["name"].split("/")[0])]
            block["params"] += count
            if weight["name"].endswith(NON_TRAINABLE):
                block["frozenStats"] += count

    summary = {
        "modelId": "mobilenet-v2-035",
        "inputShape": [INPUT_SIZE, INPUT_SIZE, 3],
        "totalLayers": sum(len(b["names"]) for b in blocks.values()) + 1,
        "totalParams": sum(b["params"] for b in blocks.values()),
        "blocks": [
            {"id": block_id, "layers": b["layers"], "layerNames": b["names"], "outShape": b["outShape"], "params": b["params"], "statParams": b["frozenStats"]}
            for block_id, b in blocks.items()
        ],
    }
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    sys.stdout.write(f"{len(summary['blocks'])} khối, {summary['totalLayers']} tầng, {summary['totalParams']} tham số → {OUT.relative_to(ROOT)}\n")


if __name__ == "__main__":
    main()
