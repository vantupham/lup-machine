import numpy as np
from itertools import combinations
from lup_helpers import luminance, average_hash, block_contrast, border_brightness, best_threshold

# Đầu vào lấy từ bước 1:
#   images: các ảnh (224, 224, 3), labels: số thứ tự lớp, splits: "train" hoặc "test"
#   CLASS_NAMES: tên các lớp, MAX_DIFF: khác ít bit hơn thế thì coi là gần trùng
#   MIN_CONTRAST: ảnh tương phản thấp hơn thế (gần như một màu) thì dấu vân tay không đáng tin
hashes, contrasts, borders = [], [], []
for image in images:
    gray = luminance(image)  # ảnh xám: mỗi điểm một số từ 0 đến 255
    hashes.append(average_hash(gray))  # dấu vân tay 16 x 16 = 256 bit
    contrasts.append(block_contrast(gray))  # các ô chênh nhau bao nhiêu
    borders.append(border_brightness(gray))  # độ sáng viền ảnh (thường là nền)

for i, j in combinations(range(len(images)), 2):
    if min(contrasts[i], contrasts[j]) < MIN_CONTRAST:
        continue  # ảnh gần như một màu: bỏ qua
    diff = int(np.sum(hashes[i] != hashes[j]))  # số bit khác nhau
    if diff <= MAX_DIFF:
        print(f"ảnh {i} ({splits[i]}) gần trùng ảnh {j} ({splits[j]}): khác {diff} bit")

train = [k for k in range(len(images)) if splits[k] == "train"]
for a, b in combinations(range(len(CLASS_NAMES)), 2):
    xa = [borders[k] for k in train if labels[k] == a]
    xb = [borders[k] for k in train if labels[k] == b]
    accuracy, cut = best_threshold(xa, xb)  # chỉ nhìn nền thì đoán đúng bao nhiêu?
    gap = abs(np.mean(xa) - np.mean(xb))  # hai lớp chênh nhau bao nhiêu độ sáng
    print(f"{CLASS_NAMES[a]} / {CLASS_NAMES[b]}: chỉ nhìn nền đúng {accuracy:.0%}, chênh {gap:.0f}")
