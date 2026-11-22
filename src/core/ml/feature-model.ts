/**
 * Thông tin mô hình trích đặc trưng. Tệp này KHÔNG được nhập TensorFlow.js,
 * để giao diện dùng được các hằng số mà không kéo cả thư viện (~1 MB) vào gói tải ban đầu.
 */
export const FEATURE_MODEL_ID = 'mobilenet-v2-035';
export const FEATURE_DIM = 1280;
/** Kích hoạt tầng out_relu trước khi lấy trung bình: lưới 7 × 7 ô, mỗi ô 1280 kênh (thứ tự hàng → cột → kênh). */
export const SPATIAL_SHAPE = { height: 7, width: 7, channels: FEATURE_DIM } as const;
