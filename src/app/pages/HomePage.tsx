import { useTranslation } from 'react-i18next';
import { ProjectTypeCards } from '@/features/studio/quick-start/ProjectTypeCards';
import { RecentProjects } from '@/features/studio/quick-start/RecentProjects';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-16">
      <section aria-labelledby="hero-title" className="grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 id="hero-title" className="font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
            {t('home.title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t('home.lead')}</p>
        </div>
        <PixelSpecimen caption={t('home.specimenCaption')} />
      </section>

      <div className="space-y-10">
        <RecentProjects />
        <section id="quick-start" aria-labelledby="quick-start-title" className="scroll-mt-6 space-y-4">
          <div>
            <h2 id="quick-start-title" className="font-display text-3xl font-bold">
              {t('quickStart.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-muted">{t('quickStart.lead')}</p>
          </div>
          <ProjectTypeCards />
        </section>
      </div>
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

function PixelSpecimen({ caption }: { readonly caption: string }) {
  return (
    <figure aria-hidden="true" className="lab-card hidden p-4 lg:block">
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
      <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}
