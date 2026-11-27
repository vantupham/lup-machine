import numpy as np
from lup_helpers import mobilenet_v2, softmax

# Đầu vào: image (224, 224, 3): ảnh mới, không lưu vào dự án
#   W, b: mô hình đã huấn luyện, CLASS_NAMES: tên các lớp
#   UNCERTAIN_BELOW: xác suất cao nhất thấp hơn thế thì máy "chưa chắc"
x = mobilenet_v2(image[None])[0]  # 1280 số (trình duyệt chạy bằng TF.js)
logits = W @ x + b  # điểm của từng lớp
p = softmax(logits[None])[0]  # đổi điểm thành xác suất, tổng bằng 1
best = int(np.argmax(p))  # lớp có xác suất cao nhất
for c in range(len(CLASS_NAMES)):
    print(f"{CLASS_NAMES[c]}: {p[c]:.1%}")
if p[best] < UNCERTAIN_BELOW:
    print(f"Máy chưa chắc: cao nhất chỉ {p[best]:.1%}")
else:
    print(f"Máy đoán: {CLASS_NAMES[best]}")
