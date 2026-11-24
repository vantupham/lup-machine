import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tf from '@tensorflow/tfjs-core';
import type { RgbaImage } from '@/core/image/preprocess';

/** Nạp mô hình tự lưu trữ trong public/models từ ổ đĩa (kiểm thử trong Node). */
export function modelFromDisk(id: string): tf.io.IOHandler {
  const dir = join(process.cwd(), 'public', 'models', id);
  const manifest = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8'));
  const buf = Buffer.concat(manifest.weightsManifest[0].paths.map((p: string) => readFileSync(join(dir, p))));
  return tf.io.fromMemory({
    modelTopology: manifest.modelTopology,
    weightSpecs: manifest.weightsManifest[0].weights,
    weightData: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    format: manifest.format,
    signature: manifest.signature,
  });
}

/** Ảnh kiểm thử dạng điểm ảnh thô (tests/fixtures/photos/*.rgb). */
export function photo(name: string, width: number, height: number): RgbaImage {
  const raw = readFileSync(join(process.cwd(), 'tests', 'fixtures', 'photos', `${name}.rgb`));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([raw[i * 3]!, raw[i * 3 + 1]!, raw[i * 3 + 2]!, 255], i * 4);
  return { width, height, data };
}

export function cropImage(img: RgbaImage, x0: number, y0: number, w: number, h: number): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    data.set(img.data.subarray(((y + y0) * img.width + x0) * 4, ((y + y0) * img.width + x0 + w) * 4), y * w * 4);
  }
  return { width: w, height: h, data };
}
