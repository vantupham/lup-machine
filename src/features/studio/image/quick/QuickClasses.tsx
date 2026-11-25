import { useTranslation } from 'react-i18next';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { ACCEPTED_IMAGE_TYPES } from '../image-file';
import { useObjectUrl } from '../useObjectUrl';

/** Số ảnh thu nhỏ hiện cho mỗi lớp (ảnh mới nhất), đủ để thấy vừa chụp được gì. */
const THUMBS_PER_CLASS = 4;

interface QuickClassesProps {
  readonly classes: readonly ClassRecord[];
  readonly markers: readonly string[];
  readonly samplesByClass: ReadonlyMap<string, readonly SampleRecord[]>;
  readonly onWebcam: (cls: ClassRecord) => void;
  readonly onUpload: (cls: ClassRecord, files: readonly File[]) => void;
  readonly onAddClass: () => void;
}

/** Cột ①: mỗi lớp một dòng gọn, chụp hoặc tải ảnh thẳng vào ngăn Dạy. */
export function QuickClasses({ classes, markers, samplesByClass, onWebcam, onUpload, onAddClass }: QuickClassesProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {classes.map((cls, i) => {
        const list = samplesByClass.get(cls.id) ?? [];
        return (
          <div key={cls.id} role="group" aria-label={cls.name} className="rounded border border-rule bg-paper p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-semibold">
                <span aria-hidden="true" className="mr-1 text-primary">{markers[i % markers.length]}</span>
                {cls.name}
              </p>
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
                📷 {t('project.quick.captureShort')}
              </button>
              <label className="btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
                🖼 {t('project.quick.uploadShort')}
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
        {t('project.quick.addClass')}
      </button>
    </div>
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
