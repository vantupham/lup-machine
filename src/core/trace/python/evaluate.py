import numpy as np
from lup_helpers import softmax

# Đầu vào lấy từ các bước trước:
#   X (n, 1280), y (n,): vector và nhãn của tập đang chấm (Kiểm tra hoặc Huấn luyện)
#   W, b: mô hình ở epoch đang xem, CLASS_NAMES: tên các lớp
p = softmax(X @ W.T + b)  # xác suất từng lớp của mọi ảnh
predicted = p.argmax(axis=1)  # lớp có xác suất cao nhất
correct = int((predicted == y).sum())
print(f"đúng {correct}/{len(y)} ảnh ({correct / len(y):.1%})")

k = len(CLASS_NAMES)
matrix = np.zeros((k, k), dtype=int)  # hàng: lớp thật, cột: máy đoán
for actual, guess in zip(y, predicted):
    matrix[actual, guess] += 1
for c in range(k):
    if matrix[c].sum() == 0:
        continue  # lớp này không có ảnh nào trong tập đang chấm
    print(f"{CLASS_NAMES[c]}: nhận ra {matrix[c, c]}/{matrix[c].sum()} ({matrix[c, c] / matrix[c].sum():.0%})")
