import { useTranslation } from 'react-i18next';
import type { SampleRecord } from '@/storage/db';
import { useObjectUrl } from './useObjectUrl';

interface SampleThumbProps {
  readonly sample: SampleRecord;
  readonly index: number;
  readonly onInspect: (sample: SampleRecord) => void;
  readonly onMove: (sample: SampleRecord) => void;
  readonly onDelete: (sample: SampleRecord) => void;
}

export function SampleThumb({ sample, index, onInspect, onMove, onDelete }: SampleThumbProps) {
  const { t } = useTranslation();
  const url = useObjectUrl(sample.image);
  const label = t('project.class.sample', { n: index + 1 });

  return (
    <li className="group relative aspect-square overflow-hidden rounded-sm border border-rule">
      <button
        type="button"
        onClick={() => onInspect(sample)}
        aria-label={`${t('project.class.inspect')}: ${label}`}
        className="block h-full w-full"
      >
        <img src={url} alt="" width={224} height={224} className="h-full w-full object-cover" loading="lazy" />
      </button>
      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-0.5 bg-ink/70 p-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onMove(sample)}
          aria-label={`${t(sample.split === 'train' ? 'project.class.moveToTest' : 'project.class.moveToTrain')}: ${label}`}
          title={t(sample.split === 'train' ? 'project.class.moveToTest' : 'project.class.moveToTrain')}
          className="rounded px-1 text-xs text-white hover:bg-white/20"
        >
          ⇄
        </button>
        <button
          type="button"
          onClick={() => onDelete(sample)}
          aria-label={`${t('project.class.deleteSample')}: ${label}`}
          title={t('project.class.deleteSample')}
          className="rounded px-1 text-xs text-white hover:bg-white/20"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
