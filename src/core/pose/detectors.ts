/**
 * Chạy mô hình nhận dạng khớp xương (MoveNet SinglePose Lightning) và điểm mốc bàn tay (MediaPipe Hand Landmark lite)
 * bằng TF.js, trả về tọa độ theo PIXEL CỦA ẢNH GỐC. Ảnh không được lưu lại; chỉ tọa độ được dùng tiếp.
 */
import * as tf from '@tensorflow/tfjs-core';
import { loadGraphModel, type GraphModel } from '@tensorflow/tfjs-converter';
import type { RgbaImage } from '@/core/image/preprocess';

export interface Keypoint {
  readonly x: number;
  readonly y: number;
  /** Độ tin cậy 0–1 mà mô hình gán cho điểm này. */
  readonly score: number;
}

export const BODY_KEYPOINTS = [
  'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
  'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist',
  'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle',
] as const;

export const HAND_KEYPOINTS = [
  'wrist',
  'thumbCmc', 'thumbMcp', 'thumbIp', 'thumbTip',
  'indexMcp', 'indexPip', 'indexDip', 'indexTip',
  'middleMcp', 'middlePip', 'middleDip', 'middleTip',
  'ringMcp', 'ringPip', 'ringDip', 'ringTip',
  'pinkyMcp', 'pinkyPip', 'pinkyDip', 'pinkyTip',
] as const;

/** Các đoạn nối để vẽ khung xương. */
export const BODY_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

export const HAND_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export const MOVENET_INPUT = 192;
export const HAND_INPUT = 224;

/** Vùng vuông trong ảnh gốc mà mô hình bàn tay nhìn vào (bàn tay cần nằm trong khung này). */
export interface SquareBox {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

function toTensor(image: RgbaImage): tf.Tensor3D {
  const rgb = new Uint8Array(image.width * image.height * 3);
  for (let i = 0, j = 0; i < image.data.length; i += 4, j += 3) {
    rgb[j] = image.data[i] as number;
    rgb[j + 1] = image.data[i + 1] as number;
    rgb[j + 2] = image.data[i + 2] as number;
  }
  return tf.tensor3d(rgb, [image.height, image.width, 3], 'int32');
}

/** Ô vuông nhỏ nhất bao trọn ảnh, ảnh nằm giữa (phần thừa là viền đen). */
export function letterboxBox(width: number, height: number): SquareBox {
  const size = Math.max(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

/** Cắt (có thể vượt mép, phần ngoài ảnh là màu đen) một ô vuông rồi đổi kích thước về `out` × `out`. */
function cropSquare(image: tf.Tensor3D, box: SquareBox, out: number): tf.Tensor4D {
  const [h, w] = image.shape;
  const boxes = tf.tensor2d([[box.y / (h - 1), box.x / (w - 1), (box.y + box.size - 1) / (h - 1), (box.x + box.size - 1) / (w - 1)]]);
  const result = tf.image.cropAndResize(tf.expandDims(tf.cast(image, 'float32'), 0) as tf.Tensor4D, boxes, [0], [out, out], 'bilinear', 0);
  boxes.dispose();
  return result;
}

export interface PoseModels {
  detectBody(image: RgbaImage): Promise<Keypoint[]>;
  /** Điểm mốc bàn tay trong ô vuông `box`; `handScore` là xác suất có bàn tay trong ô. */
  detectHand(image: RgbaImage, box: SquareBox): Promise<{ keypoints: Keypoint[]; handScore: number }>;
  dispose(): void;
}

type ModelSource = string | tf.io.IOHandler;

export async function loadPoseModel(source: ModelSource): Promise<GraphModel> {
  return loadGraphModel(source);
}

export function createBodyDetector(model: GraphModel): (image: RgbaImage) => Promise<Keypoint[]> {
  return async (image) => {
    const box = letterboxBox(image.width, image.height);
    const output = tf.tidy(() => {
      const input = tf.cast(cropSquare(toTensor(image), box, MOVENET_INPUT), 'int32');
      return model.execute(input) as tf.Tensor;
    });
    const data = await output.data();
    output.dispose();
    // đầu ra [1, 1, 17, 3] = (y, x, độ tin cậy), tọa độ 0–1 trong ô vuông đã đệm
    return BODY_KEYPOINTS.map((_, k) => ({
      y: box.y + (data[k * 3] as number) * box.size,
      x: box.x + (data[k * 3 + 1] as number) * box.size,
      score: data[k * 3 + 2] as number,
    }));
  };
}

/** Tên đầu ra của mô hình bàn tay (theo model.json): tọa độ 21 điểm (pixel của ô 224) và xác suất có bàn tay. */
export const HAND_OUTPUTS = { landmarks: 'Identity_2:0', handFlag: 'Identity_1:0' } as const;

export function createHandDetector(model: GraphModel): (image: RgbaImage, box: SquareBox) => Promise<{ keypoints: Keypoint[]; handScore: number }> {
  return async (image, box) => {
    const [landmarks, flag] = tf.tidy(() => {
      const input = tf.div(cropSquare(toTensor(image), box, HAND_INPUT), 255);
      return model.execute(input, [HAND_OUTPUTS.landmarks, HAND_OUTPUTS.handFlag]) as tf.Tensor[];
    }) as [tf.Tensor, tf.Tensor];
    const [points, score] = await Promise.all([landmarks.data(), flag.data()]);
    landmarks.dispose();
    flag.dispose();
    const scale = box.size / HAND_INPUT;
    const handScore = score[0] as number;
    return {
      handScore,
      keypoints: HAND_KEYPOINTS.map((_, k) => ({
        x: box.x + (points[k * 3] as number) * scale,
        y: box.y + (points[k * 3 + 1] as number) * scale,
        score: handScore,
      })),
    };
  };
}
