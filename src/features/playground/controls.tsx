import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DATASET_2D_KINDS, type Dataset2dKind } from '@/core/algorithms/datasets-2d';
import { colorFor, markerFor } from '@/features/studio/image/lab/class-style';

interface RangeFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly onChange: (value: number) => void;
  /** Cách hiển thị giá trị bên cạnh nhãn. */
  readonly format?: (value: number) => string;
  readonly hint?: string;
}

export function RangeField({ label, value, min, max, step = 1, onChange, format, hint }: RangeFieldProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm font-medium">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="font-mono text-primary">{format ? format(value) : value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onChange: (value: T) => void;
}

export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 w-full rounded border border-rule bg-surface px-2 py-1.5"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function DatasetSelect({ value, onChange, kinds = DATASET_2D_KINDS }: {
  readonly value: Dataset2dKind;
  readonly onChange: (kind: Dataset2dKind) => void;
  readonly kinds?: readonly Dataset2dKind[];
}) {
  const { t } = useTranslation();
  return (
    <SelectField
      label={t('playground.common.dataset')}
      value={value}
      onChange={onChange}
      options={kinds.map((k) => ({ value: k, label: t(`playground.datasets.${k}`) }))}
    />
  );
}

/** Chọn lớp cho điểm sắp thêm vào (phân biệt bằng cả ký hiệu lẫn màu). */
export function ClassPicker({ numClasses, value, onChange }: {
  readonly numClasses: number;
  readonly value: number;
  readonly onChange: (label: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="text-sm font-medium">{t('playground.common.classToAdd')}</legend>
      <div className="mt-1 flex gap-2">
        {Array.from({ length: numClasses }, (_, k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={`btn px-3 py-1 text-sm ${value === k ? 'btn-primary' : 'btn-ghost'}`}
          >
            <span aria-hidden="true" style={{ color: value === k ? undefined : colorFor(k) }}>{markerFor(k)}</span>
            {t('playground.common.className', { n: k + 1 })}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ControlPanel({ children }: { readonly children: ReactNode }) {
  return <div className="lab-card space-y-4 p-4">{children}</div>;
}

export function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="border-t-2 border-ink pt-1">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-lg font-semibold">{value}</dd>
    </div>
  );
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Gọi callback đều đặn khi delay khác null (dùng cho nút "Chạy"). */
export function useInterval(callback: () => void, delay: number | null): void {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return undefined;
    const handle = window.setInterval(() => saved.current(), delay);
    return () => window.clearInterval(handle);
  }, [delay]);
}
