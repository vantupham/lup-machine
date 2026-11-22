/**
 * Tải mô hình nền về public/models để tự lưu trữ (không phụ thuộc CDN, chạy ngoại tuyến).
 * Chạy: node scripts/fetch-models.mjs
 *
 * MobileNetV2 α=0.35, 224×224, không có tầng phân loại (no_top), định dạng TF.js LayersModel.
 * Trọng số gốc: Keras Applications (giấy phép Apache-2.0), bản chuyển đổi do Google Teachable Machine phát hành.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MODELS = [
  {
    id: 'mobilenet-v2-035',
    baseUrl:
      'https://storage.googleapis.com/teachable-machine-models/mobilenet_v2_weights_tf_dim_ordering_tf_kernels_0.35_224_no_top/',
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

for (const model of MODELS) {
  const outDir = join(ROOT, 'public', 'models', model.id);
  await mkdir(outDir, { recursive: true });

  const manifestBuf = await download(`${model.baseUrl}model.json`);
  const manifest = JSON.parse(manifestBuf.toString('utf8'));
  if (manifest.format !== 'layers-model') throw new Error(`Định dạng không mong đợi: ${manifest.format}`);
  await writeFile(join(outDir, 'model.json'), manifestBuf);
  console.warn(`${model.id}/model.json  sha256=${sha256(manifestBuf)}`);

  const shards = manifest.weightsManifest.flatMap((group) => group.paths);
  for (const shard of shards) {
    if (!SAFE_FILE_NAME.test(shard)) throw new Error(`Tên tệp không an toàn: ${shard}`);
    const buf = await download(`${model.baseUrl}${shard}`);
    await writeFile(join(outDir, shard), buf);
    console.warn(`${model.id}/${shard}  ${(buf.length / 1024 / 1024).toFixed(2)} MB  sha256=${sha256(buf)}`);
  }
}
