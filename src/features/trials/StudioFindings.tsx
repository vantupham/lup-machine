import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { findInsights, type Finding } from '@/core/ml/findings';
import { ClassMarker } from '@/ui/ClassMarker';
import { Lightbulb, Plus } from '@/ui/icons';

/** Một mẫu Kiểm tra đã được mô hình đoán, kèm bằng chứng để xem (nghe, câu văn, khung xương, số dòng…). */
export interface FindingSample {
  readonly id: string;
  readonly actual: number;
  readonly predicted: number;
  /** Xác suất mô hình gán cho lớp nó đoán (0–1). */
  readonly confidence: number;
  readonly evidence: ReactNode;
}

interface StudioFindingsProps {
  readonly classNames: readonly string[];
  readonly samples: readonly FindingSample[];
  /** id tiêu đề bước Dữ liệu, để nút "Thêm mẫu" cuộn về đó. */
  readonly dataStepId: string;
}

/** Hiện tối đa ngần này bằng chứng trong mỗi phát hiện. */
const MAX_EVIDENCE = 6;

/**
 * "Điểm đáng chú ý" cho Studio âm thanh, tư thế, văn bản, bảng số (phân loại): cặp nhóm hay nhầm,
 * nhóm khó nhất, mẫu sai mà máy vẫn chắc chắn, tập Kiểm tra nhỏ. Mỗi phát hiện kèm câu hỏi "Vì sao?",
 * bằng chứng xem được và lối về bước Dữ liệu để thêm mẫu.
 */
export function StudioFindings({ classNames, samples, dataStepId }: StudioFindingsProps) {
  const { t, i18n } = useTranslation();
  const findings = findInsights(samples, classNames.length);
  if (findings.length === 0) return null;
  const name = (i: number) => classNames[i] ?? '';
  const inCell = (actual: number, predicted: number) => samples.filter((s) => s.actual === actual && s.predicted === predicted);
  const byId = new Map(samples.map((s) => [s.id, s]));
  const addData = (classIndex: number) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      onClick={() => document.getElementById(dataStepId)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
    >
      <Plus /> {t('sampleFindings.addData', { name: name(classIndex) })}
    </button>
  );

  return (
    <section aria-labelledby={`${dataStepId}-findings`} className="lab-card space-y-3 p-4" data-testid="studio-findings">
      <h3 id={`${dataStepId}-findings`} className="flex flex-wrap items-baseline gap-2 font-semibold">
        <Lightbulb />
        {t('project.findings.title')}
        <span className="text-xs font-normal text-muted">{t('project.findings.on', { split: t('project.class.test') })}</span>
      </h3>
      <ul className="space-y-3">
        {findings.map((finding) => (
          <li key={finding.code} className="space-y-1 border-l-4 border-primary pl-3 text-sm" data-testid={`finding-${finding.code}`}>
            <p>{findingText(t, finding, name, i18n.language)}</p>
            <p className="text-xs text-muted">
              <span className="font-medium">{t('project.findings.why')}</span> {whyText(t, finding, name)}
            </p>
            {finding.code === 'top-confusion' && (
              <>
                <Evidence samples={inCell(finding.actual, finding.predicted)} />
                {addData(finding.actual)}
              </>
            )}
            {finding.code === 'weakest-class' && finding.confusedWith >= 0 && (
              <>
                <Evidence samples={inCell(finding.classIndex, finding.confusedWith)} />
                {addData(finding.classIndex)}
              </>
            )}
            {finding.code === 'confident-mistakes' && <Evidence samples={finding.ids.flatMap((id) => byId.get(id) ?? [])} showLabels classNames={classNames} isOpen />}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface EvidenceProps {
  readonly samples: readonly FindingSample[];
  /** Ghi rõ lớp thật → lớp đoán và độ tin (với danh sách trộn nhiều ô). */
  readonly showLabels?: boolean;
  readonly classNames?: readonly string[];
  readonly isOpen?: boolean;
}

/** Danh sách bằng chứng, thu gọn sẵn sau nút "Xem các mẫu này". */
function Evidence({ samples, showLabels = false, classNames = [], isOpen: initiallyOpen = false }: EvidenceProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  if (samples.length === 0) return null;
  return (
    <div className="space-y-2">
      {!initiallyOpen && (
        <button type="button" aria-expanded={isOpen} className="text-xs text-primary hover:underline" onClick={() => setIsOpen(!isOpen)}>
          {t('sampleFindings.show', { count: samples.length })}
        </button>
      )}
      {isOpen && (
        <ul className="space-y-2" data-testid="finding-evidence">
          {samples.slice(0, MAX_EVIDENCE).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
              {s.evidence}
              {showLabels && (
                <span className="text-muted">
                  <ClassMarker index={s.actual} className="mr-1" />
                  {t('sampleFindings.label', { actual: classNames[s.actual] ?? '', predicted: classNames[s.predicted] ?? '', percent: Math.round(s.confidence * 100) })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

function findingText(t: Translate, f: Finding, name: (i: number) => string, language: string): string {
  switch (f.code) {
    case 'all-correct':
      return t('sampleFindings.allCorrect', { total: f.total });
    case 'top-confusion':
      return t('sampleFindings.topConfusion', { count: f.count, support: f.support, actual: name(f.actual), predicted: name(f.predicted) });
    case 'weakest-class':
      return t('sampleFindings.weakestClass', { name: name(f.classIndex), percent: Math.round(f.recall * 100), support: f.support, other: name(f.confusedWith) });
    case 'confident-mistakes':
      return t('sampleFindings.confidentMistakes', { count: f.ids.length, percent: Math.round(f.threshold * 100) });
    case 'small-set':
      return t('sampleFindings.smallSet', { total: f.total, step: (100 / f.total).toLocaleString(language, { maximumFractionDigits: 1 }) });
  }
}

function whyText(t: Translate, f: Finding, name: (i: number) => string): string {
  switch (f.code) {
    case 'all-correct':
      return t('sampleFindings.whyAllCorrect');
    case 'top-confusion':
      return t('sampleFindings.whyTopConfusion', { actual: name(f.actual), predicted: name(f.predicted) });
    case 'weakest-class':
      return t('sampleFindings.whyWeakestClass', { name: name(f.classIndex) });
    case 'confident-mistakes':
      return t('project.findings.whyConfidentMistakes');
    case 'small-set':
      return t('project.findings.whySmallSet');
  }
}
