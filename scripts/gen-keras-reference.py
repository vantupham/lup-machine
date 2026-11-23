"""
Sinh vector đặc trưng tham chiếu bằng Keras (MobileNetV2 α=0.35, ImageNet, pooling trung bình) cho 2 ảnh xác định.
Kiểm thử src/core/ml/keras-parity.test.ts so các vector này với đặc trưng LUP Machine tính bằng TF.js,
để chắc chắn notebook Colab (dùng Keras) nhận đúng các con số mà trình duyệt đã tính.
Chạy: python scripts/gen-keras-reference.py
Yêu cầu: tensorflow (có keras 3), numpy.
"""
import json
import pathlib

import keras
import numpy as np
import tensorflow as tf

OUT = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "keras-features-reference.json"
SIZE = 224


def stripes() -> np.ndarray:
    x = np.arange(SIZE)
    v = np.where((x // 16) % 2 == 0, 255, 0).astype(np.uint8)
    row = np.repeat(v[None, :, None], 3, axis=2)
    return np.repeat(row, SIZE, axis=0)


def gradient() -> np.ndarray:
    y, x = np.mgrid[0:SIZE, 0:SIZE]
    return np.stack([x, y, (x * y) % 256], axis=-1).astype(np.uint8)


def main() -> None:
    backbone = keras.applications.MobileNetV2(
        input_shape=(SIZE, SIZE, 3), alpha=0.35, include_top=False, weights="imagenet", pooling="avg"
    )
    images = np.stack([stripes(), gradient()]).astype("float32")
    features = backbone.predict(images / 127.5 - 1.0, verbose=0)
    data = {
        "generator": f"keras {keras.__version__}, tensorflow {tf.__version__}",
        "images": ["stripes", "gradient"],
        "features": np.round(features.astype(np.float64), 7).tolist(),
    }
    OUT.write_text(json.dumps(data) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
