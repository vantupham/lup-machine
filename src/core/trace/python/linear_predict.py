# Đầu vào: x: dòng cần đoán (giá trị gốc), FEATURES: tên các cột
#   w: hệ số của từng cột, b: hệ số tự do (cả hai học ở bước 4)
total = b
for j in range(len(w)):
    total += w[j] * x[j]  # cộng đóng góp của cột j
    print(f"{FEATURES[j]}: {w[j]:.3f} × {x[j]:.2f} = {w[j] * x[j]:+.3f}")
print(f"Máy đoán: {b:.3f} + các đóng góp = {total:.2f}")
