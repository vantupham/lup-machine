import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ACCEPTED_IMAGE_TYPES } from '../image-file';
import { useObjectUrl } from '../useObjectUrl';
import { Camera, ImageUp, Pencil, Plus } from '@/ui/icons';
import { ClassMarker } from '@/ui/ClassMarker';

/** Số ảnh thu nhỏ hiện cho mỗi lớp (ảnh mới nhất), đủ để thấy vừa chụp được gì. */
const THUMBS_PER_CLASS = 4;

interface QuickClassesProps {
  readonly classes: readonly ClassRecord[];
  readonly samplesByClass: ReadonlyMap<string, readonly SampleRecord[]>;
  readonly onWebcam: (cls: ClassRecord) => void;
  readonly onUpload: (cls: ClassRecord, files: readonly File[]) => void;
  readonly onAddClass: () => void;
  readonly onRename: (cls: ClassRecord, name: string) => Promise<boolean>;
}

/** Cột 1: mỗi lớp một dòng gọn, chụp hoặc tải ảnh thẳng vào ngăn Huấn luyện. */
export function QuickClasses({ classes, samplesByClass, onWebcam, onUpload, onAddClass, onRename }: QuickClassesProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {classes.map((cls, i) => {
        const list = samplesByClass.get(cls.id) ?? [];
        return (
          <div key={cls.id} role="group" aria-label={cls.name} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <QuickClassName cls={cls} markerIndex={i} onRename={onRename} />
              <span className="shrink-0 font-mono text-xs text-muted">{t('project.quick.count', { count: list.length })}</span>
            </div>
            {list.length > 0 && (
              <ul aria-hidden="true" className="mt-2 flex gap-1">
                {list.slice(-THUMBS_PER_CLASS).map((sample) => (
                  <Thumb key={sample.id} sample={sample} />
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" onClick={() => onWebcam(cls)} aria-label={t('project.quick.capture', { name: cls.name })}>
                <Camera /> {t('project.quick.captureShort')}
              </button>
              <label className="btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                <ImageUp /> {t('project.quick.uploadShort')}
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  aria-label={t('project.quick.upload', { name: cls.name })}
                  className="sr-only"
                  onChange={(e) => {
                    // Chép danh sách tệp TRƯỚC khi xóa giá trị ô chọn: FileList sẽ rỗng sau đó.
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length > 0) onUpload(cls, files);
                  }}
                />
              </label>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-ghost w-full justify-center border-dashed text-sm" onClick={onAddClass}>
        <Plus /> {t('project.quick.addClass')}
      </button>
    </div>
  );
}

interface QuickClassNameProps {
  readonly cls: ClassRecord;
  readonly markerIndex: number;
  readonly onRename: (cls: ClassRecord, name: string) => Promise<boolean>;
}

/** Tên lớp kèm nút bút chì; bấm vào thì thành ô sửa tên ngay tại chỗ. */
function QuickClassName({ cls, markerIndex, onRename }: QuickClassNameProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate font-semibold">
          <ClassMarker index={markerIndex} className="mr-1.5" />
          {cls.name}
        </p>
        <button
          type="button"
          onClick={() => setDraft(cls.name)}
          aria-label={t('project.class.renameAria', { name: cls.name })}
          title={t('project.class.rename')}
          className="shrink-0 rounded p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Pencil />
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onRename(cls, draft)) setDraft(null);
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <input
        aria-label={t('project.class.renameLabel')}
        value={draft}
        maxLength={40}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDraft(null);
        }}
        className="min-w-0 flex-1 rounded border border-rule bg-paper px-2 py-1 text-sm"
      />
      <button type="submit" className="btn btn-primary px-2.5 py-1 text-sm">
        {t('project.class.save')}
      </button>
      <button type="button" onClick={() => setDraft(null)} className="text-sm">
        {t('project.class.cancel')}
      </button>
    </form>
  );
}

function Thumb({ sample }: { readonly sample: SampleRecord }) {
  const url = useObjectUrl(sample.image);
  return (
    <li className="size-10 overflow-hidden rounded-sm border border-rule">
      <img src={url} alt="" width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
    </li>
  );
}
