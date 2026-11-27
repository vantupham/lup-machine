import numpy as np

# Đầu vào: db (40, 97): ảnh phổ mel của đoạn âm thanh do trình duyệt tính (đơn vị dB)
#   40 dải tần (thấp đến cao) × 97 khung, mỗi khung cách nhau 10 ms; SEGMENTS = 4: chia 1 giây thành 4 phần
bands, frames = db.shape
bounds = [int(s * frames / SEGMENTS + 0.5) for s in range(SEGMENTS + 1)]  # ranh giới các phần (làm tròn như trình duyệt)
features = np.zeros(SEGMENTS * bands)
for s in range(SEGMENTS):
    part = db[:, bounds[s]:bounds[s + 1]]  # các khung của phần s
    features[s * bands:(s + 1) * bands] = part.mean(axis=1)  # độ to trung bình của từng dải tần
    print(f"phần {s + 1}: khung {bounds[s]} đến {bounds[s + 1] - 1}, dải thấp nhất {features[s * bands]:.1f} dB")
