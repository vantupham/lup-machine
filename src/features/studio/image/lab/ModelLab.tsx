import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrainOptions } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { EvaluateSection } from './EvaluateSection';
import { buildTrainingData, predictSamples } from './lab-data';
import { RepresentSection } from './RepresentSection';
import { TrainSection } from './TrainSection';
import { useFeatures } from './useFeatures';
import { useTraining, type TrainingSpeed } from './useTraining';

interface ModelLabProps {
  readonly projectId: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
}

const classesKey = (classes: readonly ClassRecord[]) => classes.map((c) => c.id).join('|');

/** Bước ③ Biểu diễn → ④ Huấn luyện → ⑤ Đánh giá, dùng chung vector đặc trưng và kết quả huấn luyện. */
export function ModelLab({ projectId, classes, samples }: ModelLabProps) {
  const { t } = useTranslation();
  const { features, missingCount, status, extractMissing } = useFeatures(projectId, samples);
  const training = useTraining();
  const [selected, setSelected] = useState<SampleRecord | null>(null);
  const [replayEpoch, setReplayEpoch] = useState<number | null>(null);
  const [trainedKey, setTrainedKey] = useState<string | null>(null);

  const readiness = useMemo(() => buildTrainingData(classes, samples, features), [classes, samples, features]);
  const isStale = trainedKey !== null && trainedKey !== classesKey(classes);
  const snapshots = isStale ? [] : training.snapshots;
  const lastEpoch = snapshots.at(-1)?.epoch ?? null;
  const shownEpoch = replayEpoch !== null && lastEpoch !== null ? Math.min(replayEpoch, lastEpoch) : lastEpoch;
  const snapshot = shownEpoch === null ? null : (snapshots[shownEpoch] ?? null);

  const predictions = useMemo(
    () => (snapshot ? predictSamples(snapshot.params, classes, samples, features) : new Map()),
    [snapshot, classes, samples, features],
  );
  const wrongIds = useMemo(() => new Set([...predictions].filter(([, p]) => !p.isCorrect).map(([id]) => id)), [predictions]);
  const samplesBySplit = useMemo(
    () => ({ train: samples.filter((s) => s.split === 'train'), test: samples.filter((s) => s.split === 'test') }),
    [samples],
  );
  const selectedSample = selected && samples.find((s) => s.id === selected.id) ? selected : null;

  const start = (options: TrainOptions, speed: TrainingSpeed) => {
    if (readiness.readiness !== 'ready') return;
    setReplayEpoch(null);
    setTrainedKey(classesKey(classes));
    training.start(readiness.data, options, speed);
  };

  return (
    <div className="space-y-12 border-t border-rule pt-8">
      <RepresentSection
        classes={classes}
        samples={samples}
        features={features}
        missingCount={missingCount}
        status={status}
        onExtract={() => void extractMissing()}
        selected={selectedSample}
        onSelect={setSelected}
        wrongIds={wrongIds}
      />
      <TrainSection
        readiness={readiness}
        numClasses={classes.length}
        snapshots={snapshots}
        status={isStale ? 'idle' : training.status}
        selectedEpoch={shownEpoch}
        onSelectEpoch={setReplayEpoch}
        onStart={start}
        onStep={training.step}
        onFinish={training.finish}
      />
      {isStale && <p role="status" className="text-sm text-warning">↻ {t('project.train.stale')}</p>}
      <EvaluateSection classes={classes} snapshot={snapshot} samplesBySplit={samplesBySplit} predictions={predictions} />
    </div>
  );
}
