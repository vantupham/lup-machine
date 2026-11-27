import { useTranslation } from 'react-i18next';
import { HASH_GRID } from '@/core/data/image-stats';
import type { DuplicatePair } from '@/core/data/deep-checks';
import type { DataCheckImage } from '@/core/trace/data-check-trace';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ClassMarker } from '@/ui/ClassMarker';
import { colorFor } from '../lab/class-style';
import { useObjectUrl } from '../useObjectUrl';

const MAX_BRIGHTNESS = 255;

interface BrightnessChartProps {
  readonly classes: readonly ClassRecord[];
  readonly images: readonly DataCheckImage[];
}

/** Mỗi lớp một hàng, mỗi ảnh một chấm theo độ sáng viền: chấm đặc là Huấn luyện, chấm rỗng là Kiểm tra. */
export function BrightnessChart({ classes, images }: BrightnessChartProps) {
  const { t, i18n } = useTranslation();
  const fmt = (v: number) => Math.round(v).toLocaleString(i18n.language);
  return (
    <figure className="space-y-2" data-testid="brightness-chart">
      <figcaption className="text-sm font-medium">{t('project.deepCheck.brightnessTitle')}</figcaption>
      {classes.map((cls, label) => {
        const values = images.filter((img) => img.label === label);
        if (values.length === 0) return null;
        const borders = values.map((img) => img.border);
        const mean = borders.reduce((a, b) => a + b, 0) / borders.length;
        return (
          <div key={cls.id} className="text-xs">
            <p className="flex items-center gap-1">
              <ClassMarker index={label} />
              <span className="truncate">{cls.name}</span>
              <span className="sr-only">
                {t('project.deepCheck.classSummary', { mean: fmt(mean), min: fmt(Math.min(...borders)), max: fmt(Math.max(...borders)) })}
              </span>
            </p>
            <div aria-hidden="true" className="relative mt-1 h-4 rounded-sm bg-gradient-to-r from-[#111] to-[#eee]">
              {values.map((img) => (
                <span
                  key={img.id}
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{
                    left: `${(img.border / MAX_BRIGHTNESS) * 100}%`,
                    borderColor: colorFor(label),
                    backgroundColor: img.split === 'train' ? colorFor(label) : 'var(--color-paper)',
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <p aria-hidden="true" className="flex justify-between text-xs text-muted">
        <span>{t('project.deepCheck.dark')}</span>
        <span>{t('project.deepCheck.light')}</span>
      </p>
      <p className="text-xs text-muted">{t('project.deepCheck.brightnessNote')}</p>
    </figure>
  );
}

/** Dấu vân tay 16 × 16: ô 1 tô đậm. */
export function Fingerprint({ hash, label }: { readonly hash: ArrayLike<number>; readonly label: string }) {
  return (
    <svg viewBox={`0 0 ${HASH_GRID} ${HASH_GRID}`} role="img" aria-label={label} className="h-12 w-12 rounded-sm border border-rule bg-paper text-ink">
      {Array.from(hash, (bit, i) =>
        bit ? <rect key={i} x={i % HASH_GRID} y={Math.floor(i / HASH_GRID)} width={1} height={1} fill="currentColor" /> : null,
      )}
    </svg>
  );
}

function Thumb({ sample }: { readonly sample: SampleRecord }) {
  const url = useObjectUrl(sample.image);
  return <img src={url} alt="" width={48} height={48} className="h-12 w-12 rounded-sm border border-rule object-cover" />;
}

interface PairRowProps {
  readonly pair: DuplicatePair;
  readonly samples: readonly SampleRecord[];
  readonly images: readonly DataCheckImage[];
}

/** Một cặp ảnh gần trùng: hai ảnh, hai dấu vân tay và số ô khác nhau. Số thứ tự ảnh khớp với dòng in của mã Python. */
export function PairRow({ pair, samples, images }: PairRowProps) {
  const { t } = useTranslation();
  const split = (i: number) => t(`project.class.${images[i]!.split}`);
  return (
    <li className="space-y-1 text-xs" data-testid="duplicate-pair">
      <p className="font-medium">{t('project.deepCheck.pairLabel', { a: pair.a, b: pair.b, splitA: split(pair.a), splitB: split(pair.b) })}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Thumb sample={samples[pair.a]!} />
        <Thumb sample={samples[pair.b]!} />
        <Fingerprint hash={images[pair.a]!.hash} label={t('project.deepCheck.fingerprint', { n: pair.a })} />
        <Fingerprint hash={images[pair.b]!.hash} label={t('project.deepCheck.fingerprint', { n: pair.b })} />
        <span className="font-mono">{t('project.deepCheck.pairDiff', { diff: pair.diff })}</span>
      </div>
    </li>
  );
}
