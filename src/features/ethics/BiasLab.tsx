import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { biasExperimentData, scoreByRegion, trainLeafModel } from '@/core/ethics/rice-leaves';
import { BIAS_INTRO, BIAS_PREDICT, BIAS_STEPS } from '@/content/ethics/ethics';
import { ExactBadge } from '@/ui/ExactBadge';
import { useModeStore } from '@/ui/mode-store';
import { GroupScores } from './GroupScores';
import { LeafScatter } from './LeafScatter';

/** Số lần lấy mẫu đã được kiểm chứng (src/core/ethics/rice-leaves.test.ts): nút "Lấy mẫu lại" xoay vòng trong đó. */
const VERIFIED_SAMPLINGS = 10;
const SAMPLING_STRIDE = 1000;

type Step = 0 | 1 | 2;

/** Thí nghiệm thiên lệch 3 bước: dữ liệu lệch → thu thêm dữ liệu → cho mô hình biết bối cảnh. */
export function BiasLab() {
  const { t } = useTranslation();
  const isExpert = useModeStore((s) => s.mode) === 'expert';
  const [step, setStep] = useState<Step | null>(null);
  const [sampling, setSampling] = useState(0);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const data = useMemo(() => biasExperimentData(sampling * SAMPLING_STRIDE), [sampling]);
  const result = useMemo(() => {
    if (step === null) return null;
    const train = step === 0 ? data.trainBiased : data.trainBalanced;
    const model = trainLeafModel(train, { useRegion: step === 2 });
    return { train, model, scores: scoreByRegion(model, data.test) };
  }, [data, step]);

  const showGroups = step !== null && (step > 0 || revealed);
  /** Còn bước chưa mở được: chưa huấn luyện, hoặc chưa dự đoán và xem kết quả theo vùng. */
  const isLocked = step === null || (step === 0 && !revealed);
  const content = step === null ? null : BIAS_STEPS[step];

  return (
    <section aria-labelledby="bias-lab-title" className="lab-card space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="bias-lab-title" lang="vi" className="mr-auto font-display text-2xl font-bold">{BIAS_INTRO.title}</h2>
        <ExactBadge label={t('ethics.exact')} hint={t('ethics.exactHint')} />
      </div>
      <p lang="vi">{BIAS_INTRO.story}</p>
      <p lang="vi" className="text-xs text-muted">{BIAS_INTRO.dataNote}</p>

      <div className="flex flex-wrap items-center gap-2">
        <ol className="flex flex-wrap gap-2" aria-label={t('ethics.stepsLabel')} aria-describedby={isLocked ? 'bias-locked-hint' : undefined}>
          {BIAS_STEPS.map((s, i) => {
            const isCurrent = step === i;
            const isAvailable = i === 0 || (step !== null && i <= step + 1 && (step > 0 || revealed));
            return (
              <li key={s.title}>
                <button
                  type="button"
                  lang="vi"
                  disabled={!isAvailable}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => setStep(i as Step)}
                  className={`btn text-sm ${isCurrent ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {s.action}
                </button>
              </li>
            );
          })}
        </ol>
        {isExpert && (
          <button type="button" onClick={() => setSampling((n) => (n + 1) % VERIFIED_SAMPLINGS)} className="btn btn-ghost ml-auto text-sm">
            {t('ethics.resample', { n: sampling + 1, total: VERIFIED_SAMPLINGS })}
          </button>
        )}
      </div>
      {isLocked && (
        <p id="bias-locked-hint" className="text-sm text-muted">{t(step === null ? 'ethics.lockedStart' : 'ethics.lockedPredict')}</p>
      )}

      {result && content && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <LeafScatter samples={result.train} model={result.model} />
          <div className="space-y-4">
            <div lang="vi">
              <h3 className="font-semibold">{content.title}</h3>
              <p className="text-sm">{content.explain}</p>
            </div>
            <GroupScores scores={result.scores} showGroups={showGroups} />
            {step === 0 && !revealed && (
              <fieldset className="space-y-2 rounded border border-rule p-3">
                <legend className="px-1 text-sm font-semibold">{t('ethics.predictTitle')}</legend>
                <p lang="vi" className="text-sm">{BIAS_PREDICT.question}</p>
                <div className="flex flex-wrap gap-3">
                  {BIAS_PREDICT.options.map((option, i) => (
                    <label key={option} lang="vi" className="flex items-center gap-1 text-sm">
                      <input type="radio" name="bias-predict" checked={prediction === i} onChange={() => setPrediction(i)} />
                      {option}
                    </label>
                  ))}
                </div>
                <button type="button" lang="vi" disabled={prediction === null} onClick={() => setRevealed(true)} className="btn btn-primary text-sm">
                  {BIAS_PREDICT.reveal}
                </button>
              </fieldset>
            )}
            {showGroups && (
              <div className="space-y-2" data-testid="bias-takeaway">
                {step === 0 && prediction !== null && (
                  <p className="text-sm font-medium">
                    {prediction === BIAS_PREDICT.answerIndex ? t('ethics.predictRight') : t('ethics.predictWrong')}
                  </p>
                )}
                <p lang="vi" className="rounded border-l-4 border-primary bg-surface p-3 text-sm">{content.takeaway}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
