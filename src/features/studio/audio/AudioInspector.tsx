import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUDIO, FRAME_COUNT, logMelSpectrogram, melBandCenters, poolFeatures, segmentBounds } from '@/core/audio/features';
import { framePower, hannWindow } from '@/core/audio/spectral';
import { RangeField, SelectField } from '@/features/playground/controls';
import type { AudioClipRecord, ClassRecord } from '@/storage/db';
import { clipSamples } from '@/storage/repositories/audio-repository';
import { ExactBadge } from '@/ui/ExactBadge';
import { FeatureGrid, SpectrogramHeat, SpectrumLine, Waveform } from './viz';
import { StepNumber } from '@/ui/StepNumber';

const WINDOW = hannWindow(AUDIO.winLength, AUDIO.nFft);

export function AudioInspector({ classes, clips }: { readonly classes: readonly ClassRecord[]; readonly clips: readonly AudioClipRecord[] }) {
  const { t } = useTranslation();
  const options = clips.map((clip) => {
    const cls = classes.find((c) => c.id === clip.classId);
    const n = clips.filter((c) => c.classId === clip.classId).indexOf(clip) + 1;
    return { value: clip.id, label: `${cls?.name ?? '?'} #${n}` };
  });
  const [clipId, setClipId] = useState<string>(options[0]?.value ?? '');
  const [frame, setFrame] = useState(Math.floor(FRAME_COUNT / 3));
  const clip = clips.find((c) => c.id === clipId) ?? clips[0];
  const samples = useMemo(() => (clip ? clipSamples(clip) : null), [clip]);
  const db = useMemo(() => (samples ? logMelSpectrogram(samples) : null), [samples]);
  const power = useMemo(() => (samples ? framePower(samples, frame, WINDOW, AUDIO.hopLength) : null), [samples, frame]);
  const centers = useMemo(() => melBandCenters(), []);
  if (!clip || !samples || !db || !power) return null;
  const pooled = poolFeatures(db);
  const bounds = segmentBounds();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56"><SelectField label={t('audio.inspector.clip')} value={clip.id} options={options} onChange={setClipId} /></div>
        <ExactBadge label={t('playground.exact')} hint={t('audio.inspector.exactHint')} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2" aria-labelledby="audio-step-wave">
          <h3 id="audio-step-wave" className="flex items-center gap-2 font-semibold"><StepNumber n={1} size="sm" />{t('audio.inspector.waveTitle')}</h3>
          <Waveform samples={samples} label={t('audio.inspector.waveLabel')} marker={{ start: frame * AUDIO.hopLength, length: AUDIO.nFft }} />
          <p className="text-xs text-muted">{t('audio.inspector.waveHint', { rate: AUDIO.sampleRate.toLocaleString('vi'), n: AUDIO.clipSamples.toLocaleString('vi') })}</p>
          <RangeField
            label={t('audio.inspector.frame')}
            value={frame}
            min={0}
            max={FRAME_COUNT - 1}
            onChange={setFrame}
            format={(v) => t('audio.inspector.frameValue', { n: v + 1, total: FRAME_COUNT, ms: v * 10 })}
          />
        </section>
        <section className="space-y-2" aria-labelledby="audio-step-fft">
          <h3 id="audio-step-fft" className="flex items-center gap-2 font-semibold"><StepNumber n={2} size="sm" />{t('audio.inspector.fftTitle')}</h3>
          <SpectrumLine power={power} label={t('audio.inspector.fftLabel', { n: frame + 1 })} />
          <p className="text-xs text-muted">{t('audio.inspector.fftHint', { win: AUDIO.winLength, nfft: AUDIO.nFft, bins: AUDIO.nFft / 2 + 1 })}</p>
        </section>
        <section className="space-y-2" aria-labelledby="audio-step-mel">
          <h3 id="audio-step-mel" className="flex items-center gap-2 font-semibold"><StepNumber n={3} size="sm" />{t('audio.inspector.melTitle')}</h3>
          <SpectrogramHeat db={db} bounds={bounds} frame={frame} label={t('audio.inspector.melLabel')} />
          <p className="text-xs text-muted">
            {t('audio.inspector.melHint', { bands: AUDIO.nMels, frames: FRAME_COUNT, low: Math.round(centers[0] ?? 0), high: Math.round(centers.at(-1) ?? 0) })}
          </p>
        </section>
        <section className="space-y-2" aria-labelledby="audio-step-pool">
          <h3 id="audio-step-pool" className="flex items-center gap-2 font-semibold"><StepNumber n={4} size="sm" />{t('audio.inspector.poolTitle')}</h3>
          <FeatureGrid values={pooled} label={t('audio.inspector.poolLabel')} testId="pooled-grid" />
          <p className="text-xs text-muted">{t('audio.inspector.poolHint', { segments: AUDIO.timeSegments, bands: AUDIO.nMels, total: pooled.length })}</p>
        </section>
      </div>
    </div>
  );
}
