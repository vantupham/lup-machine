import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useModeStore } from '@/ui/mode-store';
import { ChevronDown, ChevronUp } from '@/ui/icons';
import { STEP_DETAILS_ATTR, useStepDetailsStore } from './step-details';

interface StepDetailsProps {
  /** Khối "Dạy máy trong 3 bước" của Studio, chỉ hiện ở chế độ Khám phá. */
  readonly quick: ReactNode;
  /** Các bước chi tiết (1…6). */
  readonly children: ReactNode;
}

/**
 * Khám phá: khối làm nhanh ở trên, các bước chi tiết thu gọn sau nút "Xem từng bước bên trong"
 * (lựa chọn được nhớ). Chuyên sâu: chỉ các bước chi tiết, luôn mở.
 */
export function StepDetails({ quick, children }: StepDetailsProps) {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const isOpen = useStepDetailsStore((s) => s.isOpen);
  const setOpen = useStepDetailsStore((s) => s.setOpen);
  const isExplore = mode === 'explore';
  const showDetails = !isExplore || isOpen;
  const attr = { [STEP_DETAILS_ATTR]: true };

  return (
    <>
      {isExplore && quick}
      {isExplore && (
        <button type="button" aria-expanded={showDetails} aria-controls="step-details" onClick={() => setOpen(!showDetails)} className="btn btn-ghost">
          {showDetails ? <ChevronUp /> : <ChevronDown />}
          {t(showDetails ? 'project.details.hide' : 'project.details.show')}
        </button>
      )}
      <div id="step-details" {...attr} hidden={!showDetails} className="space-y-8">
        {children}
      </div>
    </>
  );
}
