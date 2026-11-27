import math
import re
import unicodedata

# Đầu vào lấy từ các bước trước:
#   sentence: câu đang thử, MAX_N: 1 (từng âm tiết) hoặc 2 (thêm cụm 2 âm tiết liền nhau)
#   vocab: bộ từ vựng dựng trên tập Huấn luyện, df: số câu Huấn luyện chứa mỗi từ, N: số câu Huấn luyện
tokens = re.findall(r"\w+", unicodedata.normalize("NFC", sentence).lower())  # tách âm tiết
pairs = [" ".join(tokens[i:i + 2]) for i in range(len(tokens) - 1)] if MAX_N == 2 else []
terms = tokens + pairs
counts = [terms.count(term) for term in vocab]  # đếm từng từ của bộ từ vựng
idf = [math.log((1 + N) / (1 + d)) + 1 for d in df]  # từ càng hiếm, idf càng lớn
raw = [c * w for c, w in zip(counts, idf)]
norm = math.sqrt(sum(v * v for v in raw))  # độ dài vector
tfidf = [v / norm if norm else 0.0 for v in raw]  # chia độ dài: câu dài, câu ngắn so được với nhau
for j in sorted(range(len(vocab)), key=lambda j: -tfidf[j]):
    if tfidf[j] > 0:
        print(f"{vocab[j]}: đếm {counts[j]}, idf {idf[j]:.3f}, TF-IDF {tfidf[j]:.3f}")
