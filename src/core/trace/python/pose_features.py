import math

# Đầu vào: keypoints: các khớp [(x, y, độ tin cậy), ...] mô hình tìm được trên ảnh (đơn vị: điểm ảnh)
#   KIND: "body" (cơ thể) hoặc "hand" (bàn tay), NAMES: tên các khớp, MIN_SCORE: dưới mức này là "không thấy rõ"
if KIND == "body":
    cx, cy = (keypoints[11][0] + keypoints[12][0]) / 2, (keypoints[11][1] + keypoints[12][1]) / 2  # giữa hai hông
    ux, uy = (keypoints[5][0] + keypoints[6][0]) / 2, (keypoints[5][1] + keypoints[6][1]) / 2  # giữa hai vai
else:
    cx, cy = keypoints[0][0], keypoints[0][1]  # cổ tay
    ux, uy = keypoints[9][0], keypoints[9][1]  # gốc ngón giữa
scale = math.hypot(ux - cx, uy - cy)  # đơn vị đo: chiều dài thân (hoặc lòng bàn tay)
features = []
for (x, y, score), name in zip(keypoints, NAMES):
    if score >= MIN_SCORE:
        features += [(x - cx) / scale, (y - cy) / scale]  # dời gốc tọa độ rồi chia cho đơn vị đo
    else:
        features += [0.0, 0.0]  # khớp không thấy rõ
    print(f"{name}: ({x:.0f}, {y:.0f}) → ({features[-2]:.2f}, {features[-1]:.2f})")
