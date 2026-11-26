import { useId, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnSummary } from '@/core/tabular/columns';
import type { PreparedData } from '@/core/tabular/prepare';
import type { TabularConfig } from '@/storage/schemas/tabular';
import { InlineClassName } from '@/features/studio/quick/InlineClassName';
import { Upload } from '@/ui/icons';
import { configForTarget } from '../tabular-config';
import { TABULAR_SAMPLES, type TabularSampleId } from '../tabular-samples';

interface TabularQuickDataProps {
  readonly fileName: string | null;
  readonly rowCount: number;
  readonly columns: readonly ColumnSummary[];
  readonly config: TabularConfig | null;
  readonly data: PreparedData | null;
  /** Đang chọn bảng khác (hiện lại bảng mẫu và ô tải tệp). */
  readonly isChoosing: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onChoose: (isChoosing: boolean) => void;
  readonly onLoadSample: (id: TabularSampleId) => void;
  readonly onUpload: (file: File) => void;
  readonly onConfigChange: (config: TabularConfig) => void;
  readonly onRenameClass: (from: string, to: string) => Promise<boolean>;
}

/** Cột 1: chọn bảng (mẫu hoặc tệp CSV), chọn cột máy cần đoán, xem và đổi tên các lớp. */
export function TabularQuickData(props: TabularQuickDataProps) {
  const { t } = useTranslation();
  const { fileName, config, isChoosing, error } = props;
  return (
    <div className="space-y-3">
      {fileName === null || isChoosing ? <TableChooser {...props} /> : config && <TableSummary {...props} config={config} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {fileName !== null && !isChoosing && (
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => props.onChoose(true)}>
          {t('tabular.quick.chooseOther')}
        </button>
      )}
    </div>
  );
}

function TableChooser({ fileName, busy, onChoose, onLoadSample, onUpload }: TabularQuickDataProps) {
  const { t } = useTranslation();
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // lấy tệp TRƯỚC khi xóa giá trị ô chọn tệp
    event.target.value = '';
    if (file) onUpload(file);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t('tabular.quick.empty')}</p>
      {TABULAR_SAMPLES.map((s) => (
        <button key={s.id} type="button" disabled={busy} className="btn btn-ghost w-full justify-between text-left text-sm" onClick={() => onLoadSample(s.id)}>
          <span>{t(`tabular.samples.${s.id}.name`)}</span>
          <span className="font-mono text-xs text-muted">{t('tabular.data.rowCount', { n: s.rows })}</span>
        </button>
      ))}
      <label className="btn btn-ghost w-full cursor-pointer justify-center text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
        <Upload /> {t('tabular.quick.upload')}
        <input type="file" accept=".csv,.tsv,.txt,text/csv" aria-label={t('tabular.quick.uploadAria')} className="sr-only" onChange={handleFile} disabled={busy} />
      </label>
      {fileName !== null && (
        <button type="button" className="btn btn-ghost text-sm" onClick={() => onChoose(false)}>
          {t('tabular.data.cancel')}
        </button>
      )}
    </div>
  );
}

function TableSummary({ fileName, rowCount, columns, config, data, onConfigChange, onRenameClass }: TabularQuickDataProps & { readonly config: TabularConfig }) {
  const { t } = useTranslation();
  const targetId = useId();
  const counts = classCounts(data);
  return (
    <div className="space-y-3">
      <div>
        <p className="truncate font-mono text-sm">{fileName}</p>
        <p className="text-xs text-muted">{t('tabular.quick.size', { rows: rowCount, columns: columns.length })}</p>
      </div>
      <div>
        <label htmlFor={targetId} className="block text-sm font-medium">
          {t('tabular.quick.target')}
        </label>
        <select
          id={targetId}
          value={config.target}
          onChange={(e) => {
            const next = configForTarget(columns, e.target.value, config);
            if (next) onConfigChange(next);
          }}
          className="mt-1 w-full rounded border border-rule bg-surface px-2 py-1.5 text-sm"
        >
          {columns.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">{t(`tabular.quick.task.${config.task}`)}</p>
      </div>
      {config.task === 'classification' && data && (
        <ul className="space-y-2" aria-label={t('tabular.quick.classes')}>
          {data.classNames.map((name, i) => (
            <li key={name} className="flex items-center justify-between gap-2 border-t border-rule pt-2">
              <InlineClassName name={name} markerIndex={i} onRename={(next) => onRenameClass(name, next)} />
              <span className="shrink-0 font-mono text-xs text-muted">{t('tabular.data.rowCount', { n: counts[i] ?? 0 })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Số dòng của mỗi lớp (cả Huấn luyện và Kiểm tra). */
function classCounts(data: PreparedData | null): number[] {
  if (!data) return [];
  const counts = data.classNames.map(() => 0);
  for (const y of [...data.train.y, ...data.test.y]) counts[y] = (counts[y] ?? 0) + 1;
  return counts;
}
