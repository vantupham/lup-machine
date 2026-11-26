import { useTranslation } from 'react-i18next';
import { Check, Circle, LoaderCircle, TriangleAlert } from '@/ui/icons';

export type StageState = 'pending' | 'active' | 'done' | 'error';

export interface StageView {
  readonly key: string;
  readonly label: string;
  readonly state: StageState;
  /** Dòng số liệu nhỏ dưới tên chặng (chỉ hiện khi có). */
  readonly detail?: string | null;
  /** Tiến độ 0–1 của chặng đang chạy; null nếu không đo được. */
  readonly progress?: number | null;
}

const STATE_STYLE: Record<StageState, string> = {
  pending: 'text-muted',
  active: 'font-semibold text-ink',
  done: 'text-ink',
  error: 'font-semibold text-danger',
};

/** Danh sách các chặng huấn luyện: chưa tới / đang làm / xong / lỗi, kèm số liệu và thanh tiến độ. */
export function StageList({ stages }: { readonly stages: readonly StageView[] }) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t('project.quick.stages.label')} className="space-y-1.5 text-sm">
      {stages.map((stage) => (
        <li key={stage.key} className={`flex gap-2 ${STATE_STYLE[stage.state]}`}>
          <StageIcon state={stage.state} />
          <div className="min-w-0 flex-1">
            <p>
              {stage.label}
              <span className="sr-only"> ({t(`project.quick.stages.state.${stage.state}`)})</span>
            </p>
            {stage.detail && <p className="font-mono text-xs font-normal text-muted">{stage.detail}</p>}
            {stage.state === 'active' && stage.progress != null && (
              <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-rule">
                <div
                  className="h-full origin-left rounded-full bg-primary transition-transform duration-300"
                  style={{ transform: `scaleX(${stage.progress})` }}
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StageIcon({ state }: { readonly state: StageState }) {
  if (state === 'done') return <Check className="mt-0.5 text-accent" />;
  if (state === 'active') return <LoaderCircle className="mt-0.5 animate-spin text-primary" />;
  if (state === 'error') return <TriangleAlert className="mt-0.5" />;
  return <Circle className="mt-0.5" />;
}
