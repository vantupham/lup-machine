import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SAMPLE_DATASETS } from '@/core/datasets/synthetic';
import { markerFor } from '@/features/studio/image/lab/class-style';
import { useCreateSampleProject } from './useCreateSampleProject';

/** Thẻ các bộ dữ liệu mẫu: bấm một nút là có ngay dự án đủ ảnh để thử cả quy trình. */
export function SampleDatasetsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, create } = useCreateSampleProject();
  const isBusy = state.phase === 'rendering';

  const handleCreate = async (id: (typeof SAMPLE_DATASETS)[number]['id']) => {
    const projectId = await create(id);
    if (projectId) navigate(`/studio/${projectId}`);
  };

  return (
    <section aria-labelledby="samples-title" className="space-y-3">
      <div>
        <h2 id="samples-title" className="text-lg font-semibold">{t('samples.title')}</h2>
        <p className="max-w-2xl text-sm text-muted">{t('samples.lead')}</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {SAMPLE_DATASETS.map((d) => (
          <li key={d.id} className="lab-card flex flex-col gap-2 p-4">
            <p aria-hidden="true" className="text-xl tracking-widest text-primary">
              {d.classKeys.map((_, i) => markerFor(i)).join(' ')}
            </p>
            <h3 className="font-semibold">{t(`samples.items.${d.id}.title`)}</h3>
            <p className="text-sm text-muted">{t(`samples.items.${d.id}.description`)}</p>
            <p className="font-mono text-xs">
              {t('samples.count', { images: d.perClass * d.classKeys.length, classes: d.classKeys.length })}
            </p>
            <button type="button" className="btn btn-ghost mt-auto self-start text-sm" disabled={isBusy} onClick={() => void handleCreate(d.id)}>
              {state.phase === 'rendering' && state.id === d.id
                ? t('samples.creating', { done: state.done, total: state.total })
                : t('samples.create')}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">ⓘ {t('samples.note')}</p>
      {state.phase === 'error' && <p role="alert" className="text-sm text-danger">{t('samples.error', { message: state.message })}</p>}
    </section>
  );
}
