import numpy as np

# Đầu vào lấy từ các bước trước:
#   X (n, V): số lần mỗi từ của bộ từ vựng xuất hiện trong từng câu Huấn luyện, y (n,): nhãn
#   VOCAB: bộ từ vựng, CLASS_NAMES: tên các lớp, ALPHA: làm trơn (từ chưa gặp không làm xác suất bằng 0)
n, V = X.shape
k = len(CLASS_NAMES)
sentences = np.zeros(k)  # số câu của mỗi lớp
word_count = np.zeros((k, V))  # số lần mỗi từ xuất hiện trong mỗi lớp
for i in range(n):
    sentences[y[i]] += 1
    word_count[y[i]] += X[i]
log_prior = np.log(sentences / n)  # lớp nào nhiều câu thì được cộng sẵn nhiều điểm hơn
totals = word_count.sum(axis=1, keepdims=True) + ALPHA * V
log_prob = np.log((word_count + ALPHA) / totals)  # log P(từ | lớp)
for c in range(k):
    top = np.argsort(-log_prob[c], kind="stable")[:3]  # 3 từ hay gặp nhất của lớp
    print(f"{CLASS_NAMES[c]}: {int(sentences[c])} câu, hay gặp: {', '.join(VOCAB[j] for j in top)}")
