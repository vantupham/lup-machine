import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { datasetFingerprint } from '@/core/data/fingerprint';
import type { EpochSnapshot, TrainOptions } from '@/core/ml/softmax-regression';
import type { ClassRecord, RunRecord, SampleRecord } from '@/storage/db';
import { getErrorMessage } from '@/ui/error-message';
import { buildTrainingData, predictSamples, testClassRecall, type TrainingReadiness } from './lab-data';
import { DEFAULT_TRAIN_OPTIONS } from './TrainSection';
import { useExperiments } from './useExperiments';
import { useFeatures } from './useFeatures';
import { useTraining, type TrainingSpeed } from './useTraining';

/** Lần chạy hiện tại từ đâu ra: huấn luyện mới (sẽ lưu nhật ký) hay chạy lại một lần cũ (không lưu trùng). */
type RunOrigin =
  | { readonly kind: 'new'; readonly fingerprint: string }
  | { readonly kind: 'replay' | 'restore'; readonly number: number; readonly seed: number };

export type LabNotice = { readonly kind: 'info' | 'error'; readonly text: string } | null;

function toMetrics(snapshots: readonly EpochSnapshot[]) {
  return snapshots.map((s) => ({
    epoch: s.epoch,
    trainLoss: s.train.loss,
    trainAccuracy: s.train.accuracy,
    testLoss: s.test?.loss ?? null,
    testAccuracy: s.test?.accuracy ?? null,
  }));
}

/**
 * Toàn bộ trạng thái học máy của một dự án ảnh: vector đặc trưng, huấn luyện, nhật ký thí nghiệm.
 * Dùng chung cho khối "làm nhanh" ở đầu trang và các bước 3–6 "mở nắp" bên dưới: cùng một mô hình.
 */
/** Tỉ lệ nhận ra từng lớp của mô hình cuối cùng (chỉ khi có ảnh Kiểm tra). */
function recallOf(done: readonly EpochSnapshot[], ready: TrainingReadiness) {
  const final = done.at(-1);
  if (!final || ready.readiness !== 'ready') return {};
  const recall = testClassRecall(final.params, ready.data);
  return recall ? { classRecall: recall } : {};
}

export function useImageLab(projectId: string, classes: readonly ClassRecord[], samples: readonly SampleRecord[]) {
  const { t } = useTranslation();
  const featureState = useFeatures(projectId, samples);
  const { features, extractMissing } = featureState;
  const training = useTraining();
  const experiments = useExperiments(projectId);
  const [replayEpoch, setReplayEpoch] = useState<number | null>(null);
  const [origin, setOrigin] = useState<RunOrigin | null>(null);
  const [notice, setNotice] = useState<LabNotice>(null);
  const [lastOptions, setLastOptions] = useState<TrainOptions | null>(null);
  /** Điểm Kiểm tra (0–1) học sinh đoán cho lần chạy đang hiện; null nếu không đoán. */
  const [guess, setGuess] = useState<number | null>(null);
  /** Số thứ tự trong nhật ký của lần chạy đang hiện (lần mới: có sau khi lưu xong). */
  const [currentRunNumber, setCurrentRunNumber] = useState<number | null>(null);
  const restoreAttempted = useRef(false);
  /** Mỗi lần bắt đầu huấn luyện (bất kỳ nút nào) tăng số này: "Huấn luyện nhanh" biết có lần khác chen vào. */
  const runCounter = useRef(0);
  const quickPending = useRef(false);
  /** "Huấn luyện nhanh" đang chuẩn bị (tải mô hình, trích vector) trước khi bắt đầu học: để giao diện hiện đúng bước. */
  const [isQuickPreparing, setIsQuickPreparing] = useState(false);

  const readiness = useMemo(() => buildTrainingData(classes, samples, features), [classes, samples, features]);
  const fingerprint = useMemo(() => datasetFingerprint(classes.map((c) => c.id), samples), [classes, samples]);
  const isStale = origin !== null && origin.kind === 'new' && origin.fingerprint !== fingerprint;
  const snapshots = isStale ? [] : training.snapshots;
  const lastEpoch = snapshots.at(-1)?.epoch ?? null;
  const shownEpoch = replayEpoch !== null && lastEpoch !== null ? Math.min(replayEpoch, lastEpoch) : lastEpoch;
  const snapshot = shownEpoch === null ? null : (snapshots[shownEpoch] ?? null);
  const isTraining = training.status === 'running' || training.status === 'waiting-step';

  const predictions = useMemo(
    () => (snapshot ? predictSamples(snapshot.params, classes, samples, features) : new Map()),
    [snapshot, classes, samples, features],
  );

  const runWith = (ready: TrainingReadiness, options: TrainOptions, speed: TrainingSpeed, nextOrigin: RunOrigin, runGuess: number | null = null) => {
    if (ready.readiness !== 'ready') return;
    runCounter.current++;
    setReplayEpoch(null);
    setOrigin(nextOrigin);
    setLastOptions(options);
    setGuess(runGuess);
    setCurrentRunNumber(nextOrigin.kind === 'new' ? null : nextOrigin.number);
    // Chỉ lần huấn luyện MỚI được ghi vào nhật ký (chạy lại thì không lưu trùng).
    const onDone =
      nextOrigin.kind === 'new'
        ? (done: EpochSnapshot[]) =>
            experiments
              .add({
                projectId,
                fingerprint: nextOrigin.fingerprint,
                options,
                classNames: classes.map((c) => c.name),
                counts: { train: ready.trainSamples.length, test: ready.testSamples.length },
                metrics: toMetrics(done),
                ...(runGuess === null ? {} : { guess: { testAccuracy: runGuess } }),
                ...recallOf(done, ready),
              })
              .then((saved) => setCurrentRunNumber(saved.number))
              .catch((error: unknown) =>
                setNotice({ kind: 'error', text: t('project.experiments.saveError', { message: getErrorMessage(error) }) }),
              )
        : undefined;
    training.start(ready.data, options, speed, onDone);
  };

  const run = (options: TrainOptions, speed: TrainingSpeed, nextOrigin: RunOrigin, runGuess: number | null = null) =>
    runWith(readiness, options, speed, nextOrigin, runGuess);

  /** `runGuess`: điểm Kiểm tra (0–1) học sinh đoán trước, lưu kèm lần chạy để so sau khi xong. */
  const startNew = (options: TrainOptions, speed: TrainingSpeed, runGuess: number | null = null) => {
    setNotice(null);
    run(options, speed, { kind: 'new', fingerprint }, runGuess);
  };

  /**
   * Nút "Huấn luyện nhanh" (giống Teachable Machine): biến ảnh còn thiếu thành vector rồi huấn luyện ngay
   * với thiết lập mặc định. Dùng bảng vector vừa trích xong, không chờ trạng thái React cập nhật.
   */
  const trainQuick = async () => {
    if (isTraining || quickPending.current) return;
    quickPending.current = true;
    setIsQuickPreparing(true);
    // Đã chủ động huấn luyện: không để việc tự khôi phục lần chạy cũ chen vào nữa.
    restoreAttempted.current = true;
    const startedRuns = runCounter.current;
    setNotice(null);
    try {
      const all = await extractMissing();
      // Lỗi trích (đã báo ở trạng thái vector) hoặc đã có lần huấn luyện khác bắt đầu trong lúc chờ: thôi.
      if (!all || runCounter.current !== startedRuns) return;
      const ready = buildTrainingData(classes, samples, all);
      if (ready.readiness !== 'ready') {
        setNotice({ kind: 'error', text: t('project.quick.notReady') });
        return;
      }
      runWith(ready, DEFAULT_TRAIN_OPTIONS, 'normal', { kind: 'new', fingerprint });
    } finally {
      quickPending.current = false;
      setIsQuickPreparing(false);
    }
  };

  const replay = (record: RunRecord, kind: 'replay' | 'restore') => {
    run(record.options, 'normal', { kind, number: record.number, seed: record.options.seed }, record.guess?.testAccuracy ?? null);
    setNotice({
      kind: 'info',
      text: t(kind === 'restore' ? 'project.experiments.restored' : 'project.experiments.replaying', {
        n: record.number,
        seed: record.options.seed,
      }),
    });
  };

  // Mở lại dự án: nếu dữ liệu chưa đổi, khôi phục lần chạy gần nhất bằng cách chạy lại với cùng seed.
  useEffect(() => {
    if (restoreAttempted.current || quickPending.current || !experiments.loaded || readiness.readiness !== 'ready' || training.status !== 'idle') return;
    const latest = experiments.runs[0];
    if (!latest || latest.fingerprint !== fingerprint) {
      restoreAttempted.current = true;
      return;
    }
    // Đánh dấu bên trong timer: nếu effect bị dọn dẹp trước (StrictMode), lần chạy sau vẫn khôi phục được.
    const timer = window.setTimeout(() => {
      restoreAttempted.current = true;
      replay(latest, 'restore');
    }, 0);
    return () => window.clearTimeout(timer);
    // replay chỉ cần chạy một lần khi đủ điều kiện
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiments.loaded, experiments.runs, readiness, training.status, fingerprint]);

  return {
    ...featureState,
    training,
    experiments,
    readiness,
    fingerprint,
    isStale,
    snapshots,
    shownEpoch,
    snapshot,
    isTraining,
    isQuickPreparing,
    predictions,
    notice,
    lastOptions,
    guess,
    currentRunNumber,
    setReplayEpoch,
    startNew,
    trainQuick,
    replay,
  };
}

export type ImageLab = ReturnType<typeof useImageLab>;
