import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord, Split } from '@/storage/db';
import { ACCEPTED_IMAGE_TYPES } from './image-file';
import { SampleThumb } from './SampleThumb';

export interface ClassPanelActions {
  readonly onUpload: (cls: ClassRecord, files: File[], split: Split) => void;
  readonly onWebcam: (cls: ClassRecord, split: Split) => void;
  readonly onRename: (cls: ClassRecord, name: string) => Promise<boolean>;
  readonly onDelete: (cls: ClassRecord, sampleCount: number) => void;
  readonly onInspect: (sample: SampleRecord) => void;
  readonly onMove: (sample: SampleRecord) => void;
  readonly onDeleteSample: (sample: SampleRecord) => void;
}

interface ClassPanelProps extends ClassPanelActions {
  readonly cls: ClassRecord;
  readonly samples: readonly SampleRecord[];
  readonly marker: string;
}

const SPLITS: readonly Split[] = ['train', 'test'];

export function ClassPanel({ cls, samples, marker, ...actions }: ClassPanelProps) {
  const { t } = useTranslation();
  const [split, setSplit] = useState<Split>('train');
  const fileInput = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const counts = { train: 0, test: 0 };
  for (const s of samples) counts[s.split] += 1;
  const visible = samples.filter((s) => s.split === split);

  return (
    <article aria-labelledby={headingId} className="lab-card p-4">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="text-lg text-primary">
          {marker}
        </span>
        <ClassName cls={cls} headingId={headingId} onRename={actions.onRename} />
        <span className="font-mono text-xs text-muted">
          {t('project.class.count', counts)}
        </span>
        <button
          type="button"
          onClick={() => actions.onDelete(cls, samples.length)}
          className="ml-auto text-sm text-danger hover:underline"
        >
          {t('project.class.delete')}
        </button>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex rounded border border-rule p-0.5 text-sm">
          {SPLITS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={split === s}
              onClick={() => setSplit(s)}
              className={`rounded px-3 py-1 ${split === s ? 'bg-ink text-paper' : ''}`}
            >
              {t(`project.class.${s}`)} ({counts[s]})
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={() => fileInput.current?.click()}>
          {t('project.class.upload')}
        </button>
        <button type="button" className="btn btn-ghost px-3 py-1 text-sm" onClick={() => actions.onWebcam(cls, split)}>
          {t('project.class.webcam')}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          multiple
          hidden
          data-testid={`upload-${cls.id}`}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) actions.onUpload(cls, files, split);
          }}
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded border border-dashed border-rule p-4 text-center text-sm text-muted">
          {t('project.class.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
          {visible.map((sample, i) => (
            <SampleThumb
              key={sample.id}
              sample={sample}
              index={i}
              onInspect={actions.onInspect}
              onMove={actions.onMove}
              onDelete={actions.onDeleteSample}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

interface ClassNameProps {
  readonly cls: ClassRecord;
  readonly headingId: string;
  readonly onRename: (cls: ClassRecord, name: string) => Promise<boolean>;
}

function ClassName({ cls, headingId, onRename }: ClassNameProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <>
        <h3 id={headingId} className="text-lg font-semibold">
          {cls.name}
        </h3>
        <button type="button" onClick={() => setDraft(cls.name)} className="text-sm text-primary hover:underline">
          {t('project.class.rename')}
        </button>
      </>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onRename(cls, draft)) setDraft(null);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <h3 id={headingId} className="sr-only">
        {cls.name}
      </h3>
      <input
        aria-label={t('project.class.renameLabel')}
        value={draft}
        maxLength={40}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        className="rounded border border-rule bg-paper px-2 py-1"
      />
      <button type="submit" className="btn btn-primary px-3 py-1 text-sm">
        {t('project.class.save')}
      </button>
      <button type="button" onClick={() => setDraft(null)} className="text-sm">
        {t('project.class.cancel')}
      </button>
    </form>
  );
}
