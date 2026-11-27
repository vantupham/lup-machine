import numpy as np

MASK = 0xFFFFFFFF


class Rng:
    """Số ngẫu nhiên có seed (mulberry32), cho cùng dãy số với trình duyệt."""

    def __init__(self, seed):
        self.state = seed & MASK

    def __call__(self):
        self.state = (self.state + 0x6D2B79F5) & MASK
        t = self.state
        t = ((t ^ (t >> 15)) * (t | 1)) & MASK
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & MASK)) & MASK)) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296


def glorot(rng, rows, cols):
    """Trọng số ban đầu ngẫu nhiên, nhỏ quanh 0 (cách Glorot)."""
    limit = np.sqrt(6 / (rows + cols))
    values = [(rng() * 2 - 1) * limit for _ in range(rows * cols)]
    return np.array(values, dtype=np.float32).reshape(rows, cols)


def shuffle(items, rng):
    """Trộn Fisher-Yates trên bản sao."""
    result = items.copy()
    for i in range(len(result) - 1, 0, -1):
        j = int(rng() * (i + 1))
        result[i], result[j] = result[j], result[i]
    return result


def softmax(logits):
    """Đổi điểm thành xác suất, tổng mỗi hàng bằng 1."""
    exps = np.exp(logits - logits.max(axis=1, keepdims=True))
    return exps / exps.sum(axis=1, keepdims=True)


def one_hot(y, num_classes):
    """Nhãn 2 thành [0, 0, 1, ...]."""
    return np.eye(num_classes)[y]


class Adam:
    """Bộ tối ưu Adam: mỗi lần chỉnh một bước nhỏ theo hướng giảm sai."""

    def __init__(self, shape, beta1=0.9, beta2=0.999, eps=1e-8):
        self.m = np.zeros(shape)
        self.v = np.zeros(shape)
        self.t = 0
        self.beta1, self.beta2, self.eps = beta1, beta2, eps

    def step(self, target, grad, lr):
        self.t += 1
        self.m = self.beta1 * self.m + (1 - self.beta1) * grad
        self.v = self.beta2 * self.v + (1 - self.beta2) * grad**2
        m_hat = self.m / (1 - self.beta1**self.t)
        v_hat = self.v / (1 - self.beta2**self.t)
        updated = target.astype(np.float64) - lr * m_hat / (np.sqrt(v_hat) + self.eps)
        return updated.astype(np.float32)


def evaluate(W, b, X, y):
    """Loss trung bình và tỉ lệ đúng trên cả tập."""
    p = softmax(X @ W.T + b)
    loss = -np.log(np.maximum(p[np.arange(len(y)), y], 1e-12)).mean()
    accuracy = (p.argmax(axis=1) == y).mean()
    return float(loss), float(accuracy)


def luminance(image):
    """Ảnh màu (cao, rộng, 3) thành ảnh xám: độ sáng mắt người cảm nhận."""
    rgb = image.astype(np.float64)
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def average_hash(gray, n=16):
    """Dấu vân tay: chia ảnh thành n x n ô, ô nào sáng hơn trung bình thì là 1."""
    size = gray.shape[0] // n
    blocks = gray.reshape(n, size, n, size).mean(axis=(1, 3))
    return (blocks > blocks.mean()).ravel()


def block_contrast(gray, n=16):
    """Độ tương phản: các ô n x n chênh nhau bao nhiêu (độ lệch chuẩn). Gần 0 là ảnh gần như một màu."""
    size = gray.shape[0] // n
    return float(gray.reshape(n, size, n, size).mean(axis=(1, 3)).std())


def border_brightness(gray):
    """Độ sáng trung bình của viền ảnh, dày 1/14 cạnh ảnh (224 thì 16 điểm)."""
    width = gray.shape[0] // 14
    inside = np.zeros(gray.shape, dtype=bool)
    inside[width:-width, width:-width] = True
    return float(gray[~inside].mean())


def best_threshold(xa, xb):
    """Thử mọi ngưỡng: "sáng hơn ngưỡng là lớp này". Trả về tỉ lệ đúng cao nhất và ngưỡng đó."""
    best, best_cut = 0.0, 0.0
    for cut in sorted(set(xa) | set(xb)):
        right = (sum(x <= cut for x in xa) + sum(x > cut for x in xb)) / (len(xa) + len(xb))
        accuracy = max(right, 1 - right)
        if accuracy > best:
            best, best_cut = accuracy, cut
    return best, best_cut


def mobilenet_v2(images):
    """MobileNetV2 (alpha 0.35, ImageNet) bỏ tầng phân loại, lấy trung bình 7 x 7 ô: 1280 số mỗi ảnh."""
    import keras

    model = keras.applications.MobileNetV2(input_shape=(224, 224, 3), alpha=0.35, include_top=False, pooling="avg")
    x = keras.applications.mobilenet_v2.preprocess_input(np.asarray(images, dtype=np.float32))
    return model.predict(x, verbose=0)
