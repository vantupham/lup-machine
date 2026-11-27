import numpy as np

# Đầu vào lấy từ các bước trước:
#   X (n, d): các cột số của tập Huấn luyện (giá trị gốc), COLUMNS: tên các cột số
mean = X.mean(axis=0)  # trung bình từng cột
std = X.std(axis=0)  # độ lệch chuẩn từng cột: các giá trị trải rộng bao nhiêu
std[std == 0] = 1  # cột không đổi: giữ nguyên, tránh chia cho 0
Z = (X - mean) / std  # chuẩn hóa: mỗi cột có trung bình 0, độ lệch chuẩn 1
for j in range(len(COLUMNS)):
    print(f"{COLUMNS[j]}: trung bình {mean[j]:.2f}, lệch chuẩn {std[j]:.2f}, dòng đầu {X[0, j]:.2f} → {Z[0, j]:.2f}")
