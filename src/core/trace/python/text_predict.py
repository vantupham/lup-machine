import numpy as np
from lup_helpers import text_terms

# Đầu vào: sentence: câu cần đoán, MAX_N, vocab: bộ từ vựng
#   log_prior, log_prob: mô hình Naive Bayes đã huấn luyện ở bước 4, CLASS_NAMES: tên các lớp
terms = text_terms(sentence, MAX_N)  # tách âm tiết (và cụm 2 âm tiết nếu MAX_N = 2)
x = np.array([terms.count(term) for term in vocab])  # từ lạ (không có trong bộ từ vựng) bị bỏ qua
scores = log_prior + log_prob @ x  # điểm log: cộng log P(từ | lớp) cho mỗi lần từ xuất hiện
p = np.exp(scores - scores.max())
p = p / p.sum()  # đổi điểm thành xác suất, tổng bằng 1
for c in range(len(CLASS_NAMES)):
    print(f"{CLASS_NAMES[c]}: {p[c]:.1%}")
print(f"Máy đoán: {CLASS_NAMES[int(np.argmax(p))]}")
