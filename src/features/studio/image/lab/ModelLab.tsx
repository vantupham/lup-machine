import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EpochSnapshot, TrainOptions } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { imageNotebook } from '@/core/export/image-notebook';
import { ColabExportPanel } from '@/features/export/ColabExportPanel';
import { CodeTracePanel } from '@/features/code-trace/CodeTracePanel';
import { HELPERS_PROGRAM, SOFTMAX_PROGRAM, traceSoftmaxTraining } from '@/core/trace/softmax-trace';
import { version as appVersion } from '../../../../../package.json';
import { EvaluateSection } from './EvaluateSection';
import { ExperimentLog } from './ExperimentLog';
import { RepresentSection } from './RepresentSection';
import { TrainSection } from './TrainSection';
import { useImageLabContext } from './ImageLabContext';
import { UseSection } from './UseSection';
import { ExperimentPlan } from './ExperimentPlan';
import { RunComparison } from './RunComparison';
import { setupOf } from './run-setup';
import type { ImproveActions } from './improve-actions';
import { RotateCcw } from '@/ui/icons';

interface ModelLabProps {
  readonly projectName: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly improve: ImproveActions;
}

/** Bước 3 Biểu diễn → 4 Huấn luyện → 5 Đánh giá → 6 Sử dụng (thử ảnh mới, xuất notebook) → Nhật ký thí nghiệm. */
export function ModelLab({ projectName, classes, samples, improve }: ModelLabProps) {
  const { t } = useTranslation();
  /** Trạng thái học máy dùng chung với khối "làm nhanh" ở đầu trang. */
  const lab = useImageLabContext();
  const [selected, setSelected] = useState<SampleRecord | null>(null);
  const { snapshot, snapshots, predictions, readiness, training, isStale, lastOptions } = lab;

  const wrongIds = useMemo(() => new Set([...predictions].filter(([, p]) => !p.isCorrect).map(([id]) => id)), [predictions]);
  const samplesBySplit = useMemo(
    () => ({ train: samples.filter((s) => s.split === 'train'), test: samples.filter((s) => s.split === 'test') }),
    [samples],
  );
  const selectedSample = selected && samples.find((s) => s.id === selected.id) ? selected : null;
  const finalTest = snapshots.at(-1)?.test?.accuracy;
  const runs = lab.experiments.runs;
  const latestRun = runs[0];
  const shownRun = lab.currentRunNumber === null ? undefined : runs.find((r) => r.number === lab.currentRunNumber);
  const runBefore = shownRun ? runs.find((r) => r.number < shownRun.number) : undefined;
  const renderPlan =
    latestRun && readiness.readiness === 'ready'
      ? (options: TrainOptions) => (
          <ExperimentPlan
            previousNumber={latestRun.number}
            previous={setupOf(latestRun)}
            current={{
              options,
              counts: { train: readiness.trainSamples.length, test: readiness.testSamples.length },
              classNames: classes.map((c) => c.name),
              fingerprint: lab.fingerprint,
            }}
          />
        )
      : undefined;
  const hasRun = snapshots.length > 0;
  /** Vết chạy mã Python với đúng dữ liệu và cài đặt của lần huấn luyện đang hiện. */
  const createTrace = useMemo(() => {
    if (!hasRun || !lastOptions || readiness.readiness !== 'ready') return null;
    const { train, test } = readiness.data;
    return () => traceSoftmaxTraining(train, test, lastOptions);
  }, [hasRun, lastOptions, readiness]);
  const guessResult =
    training.status === 'done' && !isStale && lab.guess !== null && finalTest !== undefined ? { guess: lab.guess, actual: finalTest } : null;

  return (
    <div className="space-y-12 border-t border-rule pt-8">
      <RepresentSection
        classes={classes}
        samples={samples}
        features={lab.features}
        missingCount={lab.missingCount}
        status={lab.status}
        onExtract={() => void lab.extractMissing()}
        selected={selectedSample}
        onSelect={setSelected}
        wrongIds={wrongIds}
        params={snapshot?.params ?? null}
        mainTrainAccuracy={snapshot?.train.accuracy ?? null}
      />
      <TrainSection
        readiness={readiness}
        numClasses={classes.length}
        snapshots={snapshots}
        status={isStale ? 'idle' : training.status}
        selectedEpoch={lab.shownEpoch}
        onSelectEpoch={lab.setReplayEpoch}
        onStart={lab.startNew}
        canGuess={readiness.readiness === 'ready' && readiness.testSamples.length > 0}
        guessResult={guessResult}
        renderPlan={renderPlan}
        afterResult={
          training.status === 'done' && !isStale && shownRun ? (
            <RunComparison key={shownRun.id} run={shownRun} previous={runBefore} onSaveConclusion={lab.experiments.setConclusion} />
          ) : undefined
        }
        onStep={training.step}
        onFinish={training.finish}
        codeTrace={<CodeTracePanel program={SOFTMAX_PROGRAM} helpers={HELPERS_PROGRAM} create={createTrace} />}
      />
      {isStale && <p role="status" className="text-sm text-warning"><RotateCcw /> {t('project.train.stale')}</p>}
      {lab.notice && (
        <p role={lab.notice.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${lab.notice.kind === 'error' ? 'text-danger' : 'text-accent'}`}>
          {lab.notice.text}
        </p>
      )}
      <EvaluateSection
        classes={classes}
        snapshot={snapshot}
        samplesBySplit={samplesBySplit}
        predictions={predictions}
        improve={improve}
        onInspect={(sample) => {
          setSelected(sample);
          // Ảnh được mở ở bước 3 (bản đồ, láng giềng, bản đồ nhiệt): cuộn tới sau khi vẽ.
          requestAnimationFrame(() => document.querySelector('[data-testid="selected-detail"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
        }}
      />
      <UseSection classes={classes} samples={samples} features={lab.features} params={snapshot?.params ?? null} epoch={snapshot?.epoch ?? null} />
      {training.status === 'done' && !isStale && lastOptions && readiness.readiness === 'ready' && snapshots.length > 0 && (
        <ColabExportPanel
          projectName={projectName}
          descriptionKey="export.colab.imageDescription"
          build={() => {
            const final = snapshots.at(-1) as EpochSnapshot;
            return imageNotebook({
              projectName,
              appVersion,
              exportedAt: new Date().toLocaleString('vi'),
              classNames: classes.map((c) => c.name),
              train: readiness.data.train,
              test: readiness.data.test,
              options: lastOptions,
              results: { trainAccuracy: final.train.accuracy, testAccuracy: final.test?.accuracy ?? null },
            });
          }}
        />
      )}
      <ExperimentLog
        runs={lab.experiments.runs}
        fingerprint={lab.fingerprint}
        canReplay={readiness.readiness === 'ready' && !lab.isTraining}
        onReplay={(record) => lab.replay(record, 'replay')}
        onDelete={(record) => void lab.experiments.remove(record.id)}
      />
    </div>
  );
}
