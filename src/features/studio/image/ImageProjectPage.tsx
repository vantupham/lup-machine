import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stratifiedSplit } from '@/core/data/split';
import type { ClassRecord, SampleRecord, Split, StoredImage } from '@/storage/db';
import { MAX_SAMPLES_PER_CLASS, type SplitCounts } from '@/storage/repositories/dataset-repository';
import { useDatasetRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';
import { PixelInspector } from '@/features/inspector/pixel/PixelInspector';
import { ClassPanel } from './ClassPanel';
import { QualityPanel } from './QualityPanel';
import { StepNav } from './StepNav';
import { WebcamCapture } from './WebcamCapture';
import { useProjectData } from './useProjectData';
import { useImageUpload } from './useImageUpload';
import { decodeStoredImage, videoFrameToStoredImage } from './image-codec.browser';

/** Lớp phân biệt bằng cả ký hiệu, không chỉ màu (thân thiện người mù màu). */
export const CLASS_MARKERS = ['●', '▲', '■', '◆', '★', '✚', '⬟', '⬢'] as const;
export const SPLIT_SEED = 42;
const TEST_RATIO = 0.2;

type Message = { readonly kind: 'info' | 'error'; readonly text: string } | null;

export function ImageProjectPage() {
  const { projectId = '' } = useParams();
  const { t } = useTranslation();
  const { data, reload } = useProjectData(projectId);

  if (data.status === 'loading') return <p>…</p>;
  if (data.status === 'not-found' || data.status === 'error') {
    return (
      <div className="space-y-4">
        <Link to="/studio" className="text-sm text-primary hover:underline">
          {t('project.back')}
        </Link>
        <p role="alert">{t(data.status === 'error' ? 'project.loadError' : 'project.notFound')}</p>
      </div>
    );
  }
  return <ProjectWorkspace projectName={data.project.name} projectId={projectId} classes={data.classes} samples={data.samples} reload={reload} />;
}

interface WorkspaceProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly classes: ClassRecord[];
  readonly samples: SampleRecord[];
  readonly reload: () => Promise<void>;
}

function ProjectWorkspace({ projectId, projectName, classes, samples, reload }: WorkspaceProps) {
  const { t } = useTranslation();
  const dataset = useDatasetRepository();
  const [message, setMessage] = useState<Message>(null);
  const [inspecting, setInspecting] = useState<SampleRecord | null>(null);
  const [webcam, setWebcam] = useState<{ cls: ClassRecord; split: Split } | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    try {
      const info = await action();
      setMessage(info ? { kind: 'info', text: info } : null);
    } catch (error: unknown) {
      setMessage({ kind: 'error', text: t('project.data.actionError', { message: getErrorMessage(error) }) });
    } finally {
      await reload();
    }
  };

  const { upload, progress } = useImageUpload(projectId, (text, kind) => setMessage({ kind, text }), reload);

  const byClass = useMemo(() => {
    const map = new Map<string, SampleRecord[]>(classes.map((c) => [c.id, []]));
    for (const s of samples) map.get(s.classId)?.push(s);
    return map;
  }, [classes, samples]);

  const counts: SplitCounts = useMemo(() => {
    const result: SplitCounts = {};
    for (const [id, list] of byClass) {
      result[id] = { train: list.filter((s) => s.split === 'train').length, test: list.filter((s) => s.split === 'test').length };
    }
    return result;
  }, [byClass]);

  const autoSplit = () =>
    run(async () => {
      const { train, test } = stratifiedSplit(
        samples.map((s) => ({ id: s.id, label: s.classId })),
        { testRatio: TEST_RATIO, seed: SPLIT_SEED },
      );
      await dataset.setSplits([
        ...train.map((s) => ({ id: s.id, split: 'train' as const })),
        ...test.map((s) => ({ id: s.id, split: 'test' as const })),
      ]);
      return t('project.data.autoSplitDone', { train: train.length, test: test.length });
    });

  const saveWebcam = (images: StoredImage[]) => {
    const target = webcam;
    setWebcam(null);
    if (!target || images.length === 0) return;
    void run(async () => {
      await dataset.addSamples(images.map((image) => ({ projectId, classId: target.cls.id, split: target.split, source: 'webcam' as const, image })));
      return t('project.upload.added', { count: images.length, name: target.cls.name, split: t(`project.class.${target.split}`) });
    });
  };

  const inspectingClass = inspecting ? classes.find((c) => c.id === inspecting.classId) : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link to="/studio" className="text-sm text-primary hover:underline">
          {t('project.back')}
        </Link>
        <h1 className="font-display text-4xl font-bold">{projectName}</h1>
        <StepNav />
      </header>

      {(message || progress) && (
        <p
          role={message?.kind === 'error' ? 'alert' : 'status'}
          className={`rounded border p-3 text-sm ${message?.kind === 'error' ? 'border-danger text-danger' : 'border-rule bg-surface'}`}
        >
          {progress ? t('project.upload.processing', progress) : message?.text}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="data-title" className="space-y-4">
          <div>
            <h2 id="data-title" className="text-2xl font-semibold">{t('project.data.title')}</h2>
            <p className="max-w-2xl text-sm text-muted">{t('project.data.lead')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <AddClassForm onAdd={(name) => run(async () => { await dataset.addClass(projectId, name); return null; })} />
            <button type="button" className="btn btn-ghost" onClick={() => void autoSplit()} disabled={samples.length === 0} title={t('project.data.autoSplitHint', { seed: SPLIT_SEED })}>
              {t('project.data.autoSplit')}
            </button>
          </div>
          {classes.map((cls, i) => (
            <ClassPanel
              key={cls.id}
              cls={cls}
              marker={CLASS_MARKERS[i % CLASS_MARKERS.length] as string}
              samples={byClass.get(cls.id) ?? []}
              onUpload={(c, files, split) => void upload(c, files, split, byClass.get(c.id)?.length ?? 0)}
              onWebcam={(c, split) => setWebcam({ cls: c, split })}
              onRename={async (c, name) => {
                try {
                  await dataset.renameClass(c.id, name);
                  await reload();
                  return true;
                } catch (error: unknown) {
                  setMessage({ kind: 'error', text: t('project.data.actionError', { message: getErrorMessage(error) }) });
                  return false;
                }
              }}
              onDelete={(c, count) => {
                if (window.confirm(t('project.class.confirmDelete', { name: c.name, count }))) {
                  void run(async () => { await dataset.deleteClass(c.id); return null; });
                }
              }}
              onInspect={setInspecting}
              onMove={(s) => void run(async () => { await dataset.setSplits([{ id: s.id, split: s.split === 'train' ? 'test' : 'train' }]); return null; })}
              onDeleteSample={(s) => void run(async () => { await dataset.deleteSample(s.id); return null; })}
            />
          ))}
        </section>
        <QualityPanel classes={classes} counts={counts} markers={CLASS_MARKERS} />
      </div>

      {inspecting && (
        <PixelInspector
          image={inspecting.image}
          title={inspectingClass?.name ?? ''}
          onClose={() => setInspecting(null)}
          decode={decodeStoredImage}
        />
      )}
      {webcam && (
        <WebcamCapture
          title={t('project.webcam.title', { name: webcam.cls.name })}
          remaining={MAX_SAMPLES_PER_CLASS - (byClass.get(webcam.cls.id)?.length ?? 0)}
          captureFrame={videoFrameToStoredImage}
          onDone={saveWebcam}
        />
      )}
    </div>
  );
}

function AddClassForm({ onAdd }: { readonly onAdd: (name: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name);
    setName('');
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        aria-label={t('project.data.newClassLabel')}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('project.data.newClassPlaceholder')}
        className="rounded border border-rule bg-surface px-3 py-2"
      />
      <button type="submit" className="btn btn-primary">
        + {t('project.data.addClass')}
      </button>
    </form>
  );
}
