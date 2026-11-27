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
