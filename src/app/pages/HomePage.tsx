import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { version } from '../../../package.json';

const PIPELINE_STEPS = ['data', 'check', 'represent', 'train', 'evaluate', 'use'] as const;
const PROMISES = ['privacy', 'honest', 'open'] as const;

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-20">
      <section aria-labelledby="hero-title" className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">
            {t('home.eyebrow')}
          </p>
          <h1
            id="hero-title"
            className="font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl"
          >
            {t('home.title')} <span className="mark block sm:inline">{t('home.titleMark')}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t('home.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/studio" className="btn btn-primary">
              {t('home.ctaStudio')} <span aria-hidden="true">→</span>
            </Link>
            <Link to="/about" className="btn btn-ghost">
              {t('home.ctaAbout')}
            </Link>
          </div>
        </div>
        <PixelSpecimen />
      </section>

      <section aria-labelledby="pipeline-title">
        <h2 id="pipeline-title" className="mb-6 font-display text-2xl font-bold">
          {t('home.pipelineTitle')}
        </h2>
        <ol aria-labelledby="pipeline-title" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {PIPELINE_STEPS.map((step, i) => (
            <li key={step} className="lab-card relative p-4 pt-8">
              <span className="absolute top-2 left-3 font-mono text-xs text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="font-semibold">{t(`home.steps.${step}`)}</p>
              <p className="mt-1 text-sm text-muted">{t(`home.stepHints.${step}`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="promises-title" className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <h2 id="promises-title" className="font-display text-3xl font-bold">
          {t('home.promisesTitle')}
        </h2>
        <dl className="grid gap-6 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p} className="border-t-2 border-ink pt-3">
              <dt className="font-semibold">{t(`home.promises.${p}Title`)}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                {t(`home.promises.${p}Body`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="font-mono text-xs text-muted">
        {t('home.status', { version })}
      </p>
    </div>
  );
}

/** Minh họa: một mẩu ảnh 6×6 điểm ảnh và các giá trị số máy tính thực sự nhìn thấy. */
const SPECIMEN: readonly (readonly number[])[] = [
  [242, 240, 236, 228, 231, 239],
  [238, 196, 142, 128, 170, 233],
  [231, 140, 64, 52, 118, 226],
  [229, 132, 58, 47, 109, 221],
  [235, 181, 121, 110, 160, 230],
  [241, 236, 229, 224, 228, 238],
];

function PixelSpecimen() {
  return (
    <figure aria-hidden="true" className="lab-card rotate-1 p-4">
      <div className="grid grid-cols-6 gap-px overflow-hidden rounded-sm bg-rule">
        {SPECIMEN.flat().map((v, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center font-mono text-[10px] sm:text-xs"
            style={{ backgroundColor: `rgb(${v} ${v} ${v})`, color: v < 128 ? '#fff' : '#1b2433' }}
          >
            {v}
          </div>
        ))}
      </div>
      <figcaption className="mt-3 font-mono text-xs text-muted">
        img[0:6, 0:6] · grayscale · uint8
      </figcaption>
    </figure>
  );
}
