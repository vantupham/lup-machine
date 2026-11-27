import numpy as np
from lup_helpers import mobilenet_v2

# Đầu vào lấy từ bước 1:
#   images: các ảnh (224, 224, 3), splits: "train" hoặc "test"
#   i: số thứ tự ảnh đang chọn trên bản đồ
features = mobilenet_v2(images)  # mỗi ảnh thành 1280 số (trình duyệt chạy bằng TF.js)
v = features[i]  # vector của ảnh đang chọn
train = np.array([k for k in range(len(images)) if splits[k] == "train" and k != i])
dots = features[train] @ v  # tích vô hướng với từng ảnh Huấn luyện
norms = np.linalg.norm(features[train], axis=1) * np.linalg.norm(v)  # tích độ dài
similarity = dots / norms  # độ giống: 1 là cùng hướng, 0 là không liên quan
order = np.argsort(-similarity, kind="stable")[:3]  # 3 ảnh giống nhất
for k in order:
    print(f"ảnh {train[k]}: giống {similarity[k]:.2f}")
