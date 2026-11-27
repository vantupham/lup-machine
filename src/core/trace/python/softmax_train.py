import numpy as np
from lup_helpers import Rng, glorot, shuffle, softmax, one_hot, Adam, evaluate

# Đầu vào lấy từ các bước trước:
#   X_train (n, d): vector đặc trưng, y_train (n,): nhãn của tập Huấn luyện
#   NUM_CLASSES, EPOCHS, LEARNING_RATE, BATCH_SIZE, SEED: cài đặt huấn luyện
n, d = X_train.shape
rng = Rng(SEED)
W = glorot(rng, NUM_CLASSES, d)  # trọng số: mỗi lớp một hàng
b = np.zeros(NUM_CLASSES, dtype=np.float32)  # độ lệch của từng lớp
adam_W, adam_b = Adam(W.shape), Adam(b.shape)

for epoch in range(1, EPOCHS + 1):
    order = shuffle(np.arange(n), rng)  # trộn thứ tự các mẫu
    for start in range(0, n, BATCH_SIZE):
        batch = order[start:start + BATCH_SIZE]  # một lô mẫu
        X, y = X_train[batch], y_train[batch]
        logits = X @ W.T + b  # điểm của từng lớp
        p = softmax(logits)  # đổi điểm thành xác suất
        loss = -np.log(p[np.arange(len(y)), y]).mean()  # sai bao nhiêu
        error = p - one_hot(y, NUM_CLASSES)  # dự đoán trừ đáp án
        grad_W = error.T @ X / len(y)  # hướng chỉnh trọng số
        grad_b = error.mean(axis=0)
        W = adam_W.step(W, grad_W, LEARNING_RATE)  # chỉnh một bước nhỏ
        b = adam_b.step(b, grad_b, LEARNING_RATE)
    train_loss, train_acc = evaluate(W, b, X_train, y_train)
    print(f"epoch {epoch}: loss {train_loss:.3f}, đúng {train_acc:.0%}")
