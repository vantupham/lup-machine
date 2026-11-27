/**
 * Sơ đồ mạng của Studio ảnh ở bước 4: MobileNetV2 (đóng băng) theo từng khối, rồi tầng Dense đang học.
 * Số liệu MobileNetV2 lấy từ mobilenet-summary.json, do scripts/build-network-summary.py đọc thẳng từ
 * public/models/mobilenet-v2-035/model.json (có test so lại với tệp mô hình).
 */
import summary from './mobilenet-summary.json';
import { FEATURE_DIM, FEATURE_MAP_LAYERS } from './feature-model';

export type LayerKind = 'ZeroPadding2D' | 'Conv2D' | 'DepthwiseConv2D' | 'BatchNormalization' | 'ReLU' | 'Add';

export interface FrozenBlock {
  readonly id: string;
  /** Số tầng mỗi loại trong khối. */
  readonly layers: Readonly<Partial<Record<LayerKind, number>>>;
  readonly layerNames: readonly string[];
  /** Kích thước đầu ra: cao × rộng × số kênh. */
  readonly outShape: readonly [number, number, number];
  readonly params: number;
  /** Phần tham số là thống kê của BatchNormalization (trung bình, phương sai), không học bằng gradient. */
  readonly statParams: number;
}

/** JSON không mang kiểu bộ ba [cao, rộng, kênh]: đã kiểm tra bằng test (network-summary.test.ts). */
export const MOBILENET_SUMMARY = summary as unknown as {
  readonly modelId: string;
  readonly inputShape: readonly [number, number, number];
  readonly totalLayers: number;
  readonly totalParams: number;
  readonly blocks: readonly FrozenBlock[];
};

/** Tầng cuối do trang tự huấn luyện: logit_k = Σ_j W[k][j]·x[j] + b[k]. */
export function denseParams(numClasses: number): { readonly weights: number; readonly bias: number; readonly total: number } {
  const weights = FEATURE_DIM * numClasses;
  return { weights, bias: numClasses, total: weights + numClasses };
}

/** Khối có tầng mở được trong trình xem bản đồ đặc trưng (bước 3, Chuyên sâu), nếu có. */
export function featureMapLayerOf(block: FrozenBlock): string | null {
  return FEATURE_MAP_LAYERS.find((l) => block.layerNames.includes(l.name))?.name ?? null;
}

/** Tên hiển thị gọn: "Conv1" → đầu mạng, "block_7" → khối 7, "Conv_1" → cuối mạng. */
export function blockLabelKey(id: string): { readonly key: 'stem' | 'block' | 'head'; readonly n?: number } {
  if (id === 'Conv1') return { key: 'stem' };
  if (id === 'Conv_1') return { key: 'head' };
  return { key: 'block', n: Number(id.replace('block_', '')) };
}
