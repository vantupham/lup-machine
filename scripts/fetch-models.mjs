/**
 * Tải mô hình nền về public/models để tự lưu trữ (không phụ thuộc CDN, chạy ngoại tuyến).
 * Chạy: node scripts/fetch-models.mjs [mã mô hình…]   (không ghi mã = tải tất cả)
 *
 * - mobilenet-v2-035: MobileNetV2 α=0.35, 224×224, không có tầng phân loại (no_top), TF.js LayersModel.
 *   Trọng số gốc: Keras Applications (Apache-2.0), bản chuyển đổi do Google Teachable Machine phát hành.
 * - movenet-lightning-4: MoveNet SinglePose Lightning v4 (17 khớp cơ thể), TF.js GraphModel, Google, Apache-2.0.
 * - hand-landmark-lite-1: MediaPipe Hand Landmark (lite, 21 điểm bàn tay), TF.js GraphModel, Google, Apache-2.0.
 * - face-detection-short-1: MediaPipe BlazeFace short-range (phát hiện khuôn mặt gần, 128×128), TF.js GraphModel, Google, Apache-2.0.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** url(tệp) trả về địa chỉ tải của tệp trong thư mục mô hình. */
const MODELS = [
  {
    id: 'mobilenet-v2-035',
    format: 'layers-model',
    url: (file) =>
      `https://storage.googleapis.com/teachable-machine-models/mobilenet_v2_weights_tf_dim_ordering_tf_kernels_0.35_224_no_top/${file}`,
  },
  {
    id: 'movenet-lightning-4',
    format: 'graph-model',
    url: (file) => `https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/${file}?tfjs-format=file`,
  },
  {
    id: 'hand-landmark-lite-1',
    format: 'graph-model',
    url: (file) => `https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/landmark/lite/1/${file}?tfjs-format=file`,
  },
  {
    id: 'face-detection-short-1',
    format: 'graph-model',
    url: (file) => `https://tfhub.dev/mediapipe/tfjs-model/face_detection/short/1/${file}?tfjs-format=file`,
  },
];

const SAFE_FILE_NAME = /^[\w.-]+$/;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải thất bại ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const wanted = new Set(process.argv.slice(2));
for (const model of MODELS.filter((m) => wanted.size === 0 || wanted.has(m.id))) {
  const outDir = join(ROOT, 'public', 'models', model.id);
  await mkdir(outDir, { recursive: true });

  const manifestBuf = await download(model.url('model.json'));
  const manifest = JSON.parse(manifestBuf.toString('utf8'));
  if (manifest.format !== model.format) throw new Error(`Định dạng không mong đợi: ${manifest.format}`);
  await writeFile(join(outDir, 'model.json'), manifestBuf);
  console.warn(`${model.id}/model.json  sha256=${sha256(manifestBuf)}`);

  const shards = manifest.weightsManifest.flatMap((group) => group.paths);
  for (const shard of shards) {
    if (!SAFE_FILE_NAME.test(shard)) throw new Error(`Tên tệp không an toàn: ${shard}`);
    const buf = await download(model.url(shard));
    await writeFile(join(outDir, shard), buf);
    console.warn(`${model.id}/${shard}  ${(buf.length / 1024 / 1024).toFixed(2)} MB  sha256=${sha256(buf)}`);
  }
}
