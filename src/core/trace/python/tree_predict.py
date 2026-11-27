import numpy as np

# Đầu vào: x: dòng cần đoán (giá trị gốc), tree: các nút của cây quyết định đã học ở bước 4
#   FEATURES: tên các cột, CLASS_NAMES: tên các lớp
node = 0  # bắt đầu từ gốc cây
while tree[node]["split"] is not None:
    f, t = tree[node]["split"]["feature"], tree[node]["split"]["threshold"]
    go_left = x[f] <= t  # câu hỏi của nút: giá trị cột f có nhỏ hơn hoặc bằng ngưỡng không?
    print(f"{FEATURES[f]} = {x[f]:.2f} {'<=' if go_left else '>'} {t:.3f}")
    node = tree[node]["split"]["left"] if go_left else tree[node]["split"]["right"]
counts = tree[node]["counts"]  # số dòng Huấn luyện của từng lớp rơi vào lá này
print(f"Lá {node}: {counts} → Máy đoán: {CLASS_NAMES[int(np.argmax(counts))]}")
