/**
 * Âm thanh tổng hợp theo seed (không thu âm, không bản quyền) cho bộ mẫu của Studio âm thanh.
 * Mỗi loại có "dấu vết" khác nhau trên ảnh phổ để học sinh nhìn ra:
 *   chuông – nhiều vạch họa âm, tắt dần; còi – một vạch tần số cao kéo dài; trống – năng lượng ở tần số thấp, tắt rất nhanh.
 */
import { gaussian } from '@/core/algorithms/datasets-2d';
import { createRng, type Rng } from '@/core/random/seeded-rng';
import { AUDIO } from './features';

export type SoundKind = 'bell' | 'whistle' | 'drum';
export const SOUND_KINDS: readonly SoundKind[] = ['bell', 'whistle', 'drum'];

const SR = AUDIO.sampleRate;
const MAX_PEAK = 0.9;

function uniform(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function synth(kind: SoundKind, rng: Rng, out: Float32Array, start: number, amplitude: number): void {
  switch (kind) {
    case 'bell': {
      const f0 = uniform(rng, 500, 900);
      const decay = uniform(rng, 0.25, 0.45);
      const partials: [number, number][] = [[1, 1], [2, 0.6], [2.76, 0.5], [5.4, 0.25]];
      for (let i = start; i < out.length; i++) {
        const t = (i - start) / SR;
        const env = Math.exp(-t / decay);
        out[i]! += amplitude * env * partials.reduce((s, [ratio, a]) => s + a * Math.sin(2 * Math.PI * f0 * ratio * t), 0) / 2.35;
      }
      return;
    }
    case 'whistle': {
      const f = uniform(rng, 1400, 2600);
      const duration = uniform(rng, 0.4, 0.7);
      const ramp = 0.03;
      let phase = 0;
      for (let i = start; i < Math.min(out.length, start + duration * SR); i++) {
        const t = (i - start) / SR;
        phase += (2 * Math.PI * (f + 20 * Math.sin(2 * Math.PI * 5 * t))) / SR;
        const env = Math.min(1, t / ramp, (duration - t) / ramp);
        out[i]! += amplitude * env * Math.sin(phase);
      }
      return;
    }
    case 'drum': {
      const decay = uniform(rng, 0.12, 0.2);
      let phase = 0;
      for (let i = start; i < out.length; i++) {
        const t = (i - start) / SR;
        const f = 60 + 90 * Math.exp(-t / 0.03);
        phase += (2 * Math.PI * f) / SR;
        const click = t < 0.005 ? gaussian(rng) * 0.4 : 0;
        out[i]! += amplitude * Math.exp(-t / decay) * (Math.sin(phase) + click);
      }
      return;
    }
  }
}

/** Một đoạn 1 giây, 16 kHz: âm bắt đầu ở thời điểm ngẫu nhiên, có tiếng ồn nền nhẹ. */
export function synthesizeSound(kind: SoundKind, seed: number): Float32Array {
  const rng = createRng(seed);
  const out = new Float32Array(AUDIO.clipSamples);
  const noise = uniform(rng, 0.003, 0.015);
  for (let i = 0; i < out.length; i++) out[i] = gaussian(rng) * noise;
  synth(kind, rng, out, Math.floor(uniform(rng, 0.05, 0.3) * SR), uniform(rng, 0.3, 0.8));
  // như một bản ghi tốt: không bao giờ chạm mức tối đa (tránh bị "rè")
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > MAX_PEAK) for (let i = 0; i < out.length; i++) out[i]! *= MAX_PEAK / peak;
  return out;
}

export const SOUNDS_PER_KIND = 16;

export function soundDataset(seed = 1): { kind: SoundKind; seed: number; signal: Float32Array }[] {
  return SOUND_KINDS.flatMap((kind, k) =>
    Array.from({ length: SOUNDS_PER_KIND }, (_, i) => {
      const s = seed * 10_000 + k * 1_000 + i;
      return { kind, seed: s, signal: synthesizeSound(kind, s) };
    }),
  );
}
