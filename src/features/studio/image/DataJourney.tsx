import { useTranslation } from 'react-i18next';
import type { SampleRecord } from '@/storage/db';
import { ArrowRight } from '@/ui/icons';

/** Cạnh ảnh sau khi cắt vuông và thu nhỏ (MobileNetV2 nhận ảnh 224 × 224). */
const IMAGE_SIDE = 224;
const CHANNELS = 3;

interface DataJourneyProps {
  readonly classCount: number;
  readonly samples: readonly SampleRecord[];
}

/** Bước 1 nhìn tổng thể: ảnh → gắn nhãn lớp → chia hai tập, với số liệu thật của dự án. */
export function DataJourney({ classCount, samples }: DataJourneyProps) {
  const { t, i18n } = useTranslation();
  const train = samples.filter((s) => s.split === 'train').length;
  const numbers = (IMAGE_SIDE * IMAGE_SIDE * CHANNELS).toLocaleString(i18n.language);
  const boxes = [
    { key: 'images', title: t('project.journey.images', { count: samples.length }), sub: t('project.journey.imagesSub', { side: IMAGE_SIDE, numbers }) },
    { key: 'classes', title: t('project.journey.classes', { count: classCount }), sub: t('project.journey.classesSub') },
    { key: 'split', title: t('project.journey.split', { train, test: samples.length - train }), sub: t('project.journey.splitSub') },
  ];
  return (
    <ol aria-label={t('project.journey.label')} className="flex flex-col gap-2 text-sm sm:flex-row sm:items-stretch" data-testid="data-journey">
      {boxes.map((box, i) => (
        <li key={box.key} className="flex items-center gap-2 sm:flex-1">
          <div className="w-full rounded border border-rule bg-surface p-2">
            <p className="font-semibold">{box.title}</p>
            <p className="text-xs text-muted">{box.sub}</p>
          </div>
          {i < boxes.length - 1 && <ArrowRight className="hidden shrink-0 text-muted sm:block" />}
        </li>
      ))}
    </ol>
  );
}
