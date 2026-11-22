import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { parsePhotoManifest, PHOTO_DATASETS, type PhotoDatasetId, type PhotoManifest } from '@/core/datasets/photo';
import { SAMPLE_DATASETS } from '@/core/datasets/synthetic';
import { markerFor } from '@/features/studio/image/lab/class-style';
import { photoDatasetUrl, useCreateSampleProject, type AnyDatasetId, type CreateState } from './useCreateSampleProject';

/** Thẻ các bộ dữ liệu mẫu: bấm một nút là có ngay dự án đủ ảnh để thử cả quy trình. */
export function SampleDatasetsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, create } = useCreateSampleProject();

  const handleCreate = async (id: AnyDatasetId) => {
    const projectId = await create(id);
    if (projectId) navigate(`/studio/${projectId}`);
  };

  return (
    <section aria-labelledby="samples-title" className="space-y-3">
      <div>
        <h2 id="samples-title" className="text-lg font-semibold">{t('samples.title')}</h2>
        <p className="max-w-2xl text-sm text-muted">{t('samples.lead')}</p>
      </div>
      <h3 className="text-sm font-semibold">{t('samples.syntheticTitle')}</h3>
      <ul className="grid gap-3 md:grid-cols-3" aria-label={t('samples.syntheticTitle')}>
        {SAMPLE_DATASETS.map((d) => (
          <DatasetCard key={d.id} id={d.id} classCount={d.classKeys.length} images={d.perClass * d.classKeys.length} state={state} onCreate={handleCreate} />
        ))}
      </ul>
      <p className="text-xs text-muted">ⓘ {t('samples.note')}</p>
      <h3 className="pt-2 text-sm font-semibold">{t('samples.photoTitle')}</h3>
      <ul className="grid gap-3 md:grid-cols-2" aria-label={t('samples.photoTitle')}>
        {PHOTO_DATASETS.map((d) => (
          <DatasetCard
            key={d.id}
            id={d.id}
            classCount={d.classKeys.length}
            images={(d.trainPerClass + d.testPerClass) * d.classKeys.length}
            state={state}
            onCreate={handleCreate}
          >
            <p className="text-xs">
              <span className="rounded border border-rule px-1.5 py-0.5 font-mono">{d.license}</span> {t(`samples.items.${d.id}.source`)}
            </p>
            <CreditsList id={d.id} />
          </DatasetCard>
        ))}
      </ul>
      <p className="text-xs text-muted">ⓘ {t('samples.photoNote')}</p>
      {state.phase === 'error' && <p role="alert" className="text-sm text-danger">{t('samples.error', { message: state.message })}</p>}
    </section>
  );
}

interface DatasetCardProps {
  readonly id: AnyDatasetId;
  readonly classCount: number;
  readonly images: number;
  readonly state: CreateState;
  readonly onCreate: (id: AnyDatasetId) => Promise<void>;
  readonly children?: ReactNode;
}

function DatasetCard({ id, classCount, images, state, onCreate, children }: DatasetCardProps) {
  const { t } = useTranslation();
  return (
    <li className="lab-card flex flex-col gap-2 p-4">
      <p aria-hidden="true" className="text-xl tracking-widest text-primary">
        {Array.from({ length: classCount }, (_, i) => markerFor(i)).join(' ')}
      </p>
      <h4 className="font-semibold">{t(`samples.items.${id}.title`)}</h4>
      <p className="text-sm text-muted">{t(`samples.items.${id}.description`)}</p>
      <p className="font-mono text-xs">{t('samples.count', { images, classes: classCount })}</p>
      {children}
      <button type="button" className="btn btn-ghost mt-auto self-start text-sm" disabled={state.phase === 'rendering'} onClick={() => void onCreate(id)}>
        {state.phase === 'rendering' && state.id === id ? t('samples.creating', { done: state.done, total: state.total }) : t('samples.create')}
      </button>
    </li>
  );
}

type CreditsState = { readonly status: 'idle' | 'loading' } | { readonly status: 'ready'; readonly manifest: PhotoManifest } | { readonly status: 'error' };

/** Ghi công đầy đủ từng ảnh, chỉ tải khi mở ra. */
function CreditsList({ id }: { readonly id: PhotoDatasetId }) {
  const { t } = useTranslation();
  const [credits, setCredits] = useState<CreditsState>({ status: 'idle' });

  const load = () => {
    if (credits.status !== 'idle') return;
    setCredits({ status: 'loading' });
    fetch(photoDatasetUrl(id, 'manifest.json'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (json: unknown) => setCredits({ status: 'ready', manifest: parsePhotoManifest(json, id) }),
        () => setCredits({ status: 'error' }),
      );
  };

  return (
    <details className="text-xs" onToggle={(e) => (e.currentTarget.open ? load() : undefined)}>
      <summary className="cursor-pointer">{t('samples.credits')}</summary>
      {credits.status === 'loading' && <p role="status">{t('samples.creditsLoading')}</p>}
      {credits.status === 'error' && <p role="alert" className="text-danger">{t('samples.creditsError')}</p>}
      {credits.status === 'ready' && (
        <div className="mt-1 space-y-1">
          <p className="text-muted">{credits.manifest.changes}</p>
          <ol className="max-h-48 list-decimal overflow-y-auto pl-5" data-testid="credits-list">
            {credits.manifest.images.map((im) => (
              <li key={im.file}>
                <span className="font-mono">{im.file}</span>:{' '}
                <a href={im.credit.source} target="_blank" rel="noopener noreferrer" className="underline">
                  {im.credit.author}
                </a>{' '}
                ({im.credit.license})
              </li>
            ))}
          </ol>
        </div>
      )}
    </details>
  );
}
