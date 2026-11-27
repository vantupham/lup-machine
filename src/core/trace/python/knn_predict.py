import numpy as np

# Đầu vào: x: dòng cần đoán (đã chuẩn hóa như bước 3), X_train (n, d): các dòng Huấn luyện (đã chuẩn hóa)
#   y_train: lớp hoặc giá trị của từng dòng, K: số láng giềng, ROWS: số thứ tự dòng trong bảng
#   TASK: "classification" (phân loại) hoặc "regression" (hồi quy), CLASS_NAMES: tên các lớp
distances = np.sqrt(((X_train - x) ** 2).sum(axis=1))  # khoảng cách Euclid tới từng dòng
nearest = np.argsort(distances, kind="stable")[:K]  # K dòng gần nhất
for i in nearest:
    print(f"dòng {ROWS[i]}: khoảng cách {distances[i]:.3f}")
if TASK == "classification":
    votes = np.bincount(y_train[nearest], minlength=len(CLASS_NAMES))  # mỗi láng giềng một phiếu
    print(f"Phiếu: {votes.tolist()} → Máy đoán: {CLASS_NAMES[int(np.argmax(votes))]}")
else:
    print(f"Máy đoán: trung bình {K} láng giềng = {y_train[nearest].mean():.2f}")
