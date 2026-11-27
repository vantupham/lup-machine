import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInlineEdit } from '@/features/studio/useInlineEdit';
import type { ClassRecord, SampleRecord, Split } from '@/storage/db';
import { ACCEPTED_IMAGE_TYPES } from './image-file';
import { SampleThumb } from './SampleThumb';
import { ClassMarker } from '@/ui/ClassMarker';
import { Pencil, Trash2 } from '@/ui/icons';

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
  readonly markerIndex: number;
}

const SPLITS: readonly Split[] = ['train', 'test'];

export function ClassPanel({ cls, samples, markerIndex, ...actions }: ClassPanelProps) {
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
        <ClassMarker index={markerIndex} className="text-lg" />
        <ClassName cls={cls} headingId={headingId} onRename={actions.onRename} />
        <span className="font-mono text-xs text-muted">
          {t('project.class.count', counts)}
        </span>
        <button
          type="button"
          onClick={() => actions.onDelete(cls, samples.length)}
          aria-label={t('project.class.deleteAria', { name: cls.name })}
          title={t('project.class.delete')}
          className="ml-auto rounded p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 />
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

/** Tên lớp kèm bút chì: bấm vào thì sửa tại chỗ, Enter hoặc rời ô là tự lưu, Esc hủy. */
function ClassName({ cls, headingId, onRename }: ClassNameProps) {
  const { t } = useTranslation();
  const { isEditing, isSaving, start, triggerRef, inputRef, inputProps } = useInlineEdit({ value: cls.name, onSave: (name) => onRename(cls, name) });

  if (!isEditing) {
    return (
      <>
        <h3 id={headingId} className="text-lg font-semibold">
          {cls.name}
        </h3>
        <button
          ref={triggerRef}
          type="button"
          onClick={start}
          aria-label={t('project.class.renameAria', { name: cls.name })}
          title={t('project.class.rename')}
          className="rounded p-1.5 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil />
        </button>
      </>
    );
  }

  return (
    <>
      <h3 id={headingId} className="sr-only">
        {cls.name}
      </h3>
      <input
        ref={inputRef}
        {...inputProps}
        aria-label={t('project.class.renameLabel')}
        title={t('project.class.renameHint')}
        maxLength={40}
        aria-busy={isSaving}
        className="rounded border border-primary bg-paper px-2 py-1 text-lg font-semibold"
      />
    </>
  );
}
