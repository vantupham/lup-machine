/** Các hình vẽ của Studio âm thanh (SVG thuần để chạy được cả khi không có canvas). */
import { AUDIO } from '@/core/audio/features';
import { powerToDb } from '@/core/audio/spectral';

const W = 400;

/** Dạng sóng: mỗi cột vẽ đoạn từ giá trị nhỏ nhất tới lớn nhất của các mẫu rơi vào cột đó. */
export function Waveform({ samples, label, marker, height = 80 }: { readonly samples: Float32Array; readonly label: string; readonly marker?: { start: number; length: number } | null; readonly height?: number }) {
  const columns = 200;
  const per = Math.max(1, Math.floor(samples.length / columns));
  const mid = height / 2;
  const segments: string[] = [];
  for (let c = 0; c < columns; c++) {
    let lo = 0;
    let hi = 0;
    for (let i = c * per; i < Math.min(samples.length, (c + 1) * per); i++) {
      lo = Math.min(lo, samples[i] as number);
      hi = Math.max(hi, samples[i] as number);
    }
    const x = (c / columns) * W;
    segments.push(`M${x.toFixed(1)},${(mid - hi * mid).toFixed(1)}V${(mid - lo * mid).toFixed(1)}`);
  }
  const scale = W / samples.length;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full rounded border border-rule bg-surface" role="img" aria-label={label}>
      <line x1={0} x2={W} y1={mid} y2={mid} className="stroke-rule" />
      {marker && <rect x={marker.start * scale} width={Math.max(1, marker.length * scale)} y={0} height={height} fill="var(--color-highlight)" fillOpacity={0.7} />}
      <path d={segments.join('')} stroke="var(--color-primary)" strokeWidth={1.5} fill="none" />
    </svg>
  );
}

/** Phổ công suất của một khung (dB) theo tần số 0 – 8 kHz. */
export function SpectrumLine({ power, label }: { readonly power: Float64Array; readonly label: string }) {
  const height = 120;
  const db = Array.from(power, (p) => powerToDb(p));
  const top = Math.max(...db);
  const bottom = top - 100;
  const points = db.map((v, k) => `${((k / (db.length - 1)) * W).toFixed(1)},${(((top - Math.max(v, bottom)) / (top - bottom)) * (height - 14)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full rounded border border-rule bg-surface" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />
      {[0, 2000, 4000, 6000, 8000].map((hz) => (
        <text key={hz} x={(hz / 8000) * (W - 20) + 2} y={height - 2} className="fill-muted text-[9px]">{hz / 1000} kHz</text>
      ))}
    </svg>
  );
}

/** Ảnh phổ: hàng = dải mel (thấp ở dưới), cột = khung thời gian; càng sáng càng to. */
export function SpectrogramHeat({ db, label, bounds, frame }: { readonly db: readonly Float64Array[]; readonly label: string; readonly bounds?: readonly number[]; readonly frame?: number | null }) {
  const bands = db.length;
  const frames = db[0]?.length ?? 0;
  const height = 160;
  const cw = W / Math.max(1, frames);
  const ch = height / Math.max(1, bands);
  let max = -Infinity;
  for (const row of db) for (const v of row) max = Math.max(max, v);
  const min = max - 80;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full rounded border border-rule bg-ink" role="img" aria-label={label} data-testid="spectrogram">
      {db.map((row, m) =>
        Array.from(row, (v, t) => (
          <rect key={`${m}-${t}`} x={t * cw} y={height - (m + 1) * ch} width={cw + 0.3} height={ch + 0.3} fill="#E69F00" fillOpacity={Math.max(0, (v - min) / (max - min))} />
        )),
      )}
      {bounds?.slice(1, -1).map((b) => <line key={b} x1={b * cw} x2={b * cw} y1={0} y2={height} stroke="#ffffff" strokeOpacity={0.6} strokeDasharray="3 3" />)}
      {frame !== undefined && frame !== null && <rect x={frame * cw} width={cw} y={0} height={height} fill="none" stroke="#ffffff" strokeWidth={1.5} />}
    </svg>
  );
}

/** Lưới 40 dải × 4 đoạn. Thường: càng sáng càng to. Hai chiều (diverging): xanh dương = âm, cam = dương. */
export function FeatureGrid({ values, label, diverging = false, testId }: { readonly values: ArrayLike<number>; readonly label: string; readonly diverging?: boolean; readonly testId?: string }) {
  const bands = AUDIO.nMels;
  const segments = AUDIO.timeSegments;
  const cell = 8;
  const arr = Array.from(values);
  const maxAbs = Math.max(1e-9, ...arr.map(Math.abs));
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  return (
    <svg viewBox={`0 0 ${segments * cell * 3} ${bands * cell}`} className="h-48 w-auto rounded border border-rule bg-surface" role="img" aria-label={label} data-testid={testId}>
      {arr.map((v, i) => {
        const s = Math.floor(i / bands);
        const m = i % bands;
        const fill = diverging ? (v >= 0 ? '#D55E00' : '#0072B2') : '#E69F00';
        const opacity = diverging ? Math.abs(v) / maxAbs : (v - min) / Math.max(1e-9, max - min);
        return <rect key={i} x={s * cell * 3} y={(bands - 1 - m) * cell} width={cell * 3 - 0.5} height={cell - 0.5} fill={fill} fillOpacity={opacity} data-value={v.toFixed(4)} />;
      })}
    </svg>
  );
}
