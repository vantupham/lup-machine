/**
 * Thông tin mô hình trích đặc trưng. Tệp này KHÔNG được nhập TensorFlow.js,
 * để giao diện dùng được các hằng số mà không kéo cả thư viện (~1 MB) vào gói tải ban đầu.
 */
export const FEATURE_MODEL_ID = 'mobilenet-v2-035';
export const FEATURE_DIM = 1280;
/** Kích hoạt tầng out_relu trước khi lấy trung bình: lưới 7 × 7 ô, mỗi ô 1280 kênh (thứ tự hàng → cột → kênh). */
export const SPATIAL_SHAPE = { height: 7, width: 7, channels: FEATURE_DIM } as const;

/** Mức độ "sâu" của một tầng, dùng để giải thích cho học sinh tầng đó thường nhận ra gì. */
export type LayerDepth = 'early' | 'middle' | 'late';

export interface FeatureMapLayer {
  readonly name: string;
  readonly depth: LayerDepth;
}

/** Các tầng được mở ra trong trình xem bản đồ đặc trưng, từ gần ảnh (nét, màu) đến gần đầu ra (khái niệm). */
export const FEATURE_MAP_LAYERS: readonly FeatureMapLayer[] = [
  { name: 'Conv1_relu', depth: 'early' },
  { name: 'block_3_expand_relu', depth: 'early' },
  { name: 'block_6_expand_relu', depth: 'middle' },
  { name: 'block_13_expand_relu', depth: 'middle' },
  { name: 'out_relu', depth: 'late' },
];
