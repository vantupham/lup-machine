import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizationFrame, type PoseKind } from '@/core/pose/features';
import { BODY_POSES, HAND_POSES, poseDataset } from '@/core/pose/synthetic-poses';
import type { ClassRecord } from '@/storage/db';
import type { DatasetRepository } from '@/storage/repositories/dataset-repository';
import type { PoseRepository } from '@/storage/repositories/pose-repository';
import { getErrorMessage } from '@/ui/error-message';
import { nextClassName } from '@/features/studio/next-class-name';
import { grabFrame, imageFromFile, loadDetector, type PoseDetection } from './pose-io.browser';

/** "Ghi liên tiếp": số mẫu và khoảng cách giữa hai mẫu; có 3 giây đếm ngược để kịp tạo dáng. */
export const BURST_COUNT = 10;
const BURST_INTERVAL_MS = 300;
const COUNTDOWN_SECONDS = 3;
/** Bàn tay: chỉ ghi khi mô hình khá chắc có bàn tay trong khung. */
const MIN_HAND_SCORE = 0.5;

/** Camera đang mở ở đâu: khối "Dạy máy trong 3 bước" hay bước 1. Chỉ mở một camera một lúc. */
export type CameraHost = 'quick' | 'details';

export type PoseMessage = { readonly kind: 'info' | 'error'; readonly text: string } | null;

interface PoseDataOptions {
  readonly projectId: string;
  readonly kind: PoseKind;
  readonly classes: readonly ClassRecord[];
  readonly dataset: DatasetRepository;
  readonly repo: PoseRepository;
  readonly onChanged: () => Promise<void>;
}

function usable(kind: PoseKind, d: PoseDetection): boolean {
  return normalizationFrame(kind, d.keypoints) !== null && (kind === 'body' || d.score >= MIN_HAND_SCORE);
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * Ghi, tải, đổi tên, xóa mẫu tư thế và nhóm của một dự án, kèm trạng thái camera dùng chung.
 * Khối "Dạy máy trong 3 bước" và bước 1 cùng dùng, nên chỉ có một camera và một lần ghi một lúc.
 */
export function usePoseData({ projectId, kind, classes, dataset, repo, onChanged }: PoseDataOptions) {
  const { t } = useTranslation();
  const [camera, setCameraState] = useState<CameraHost | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<PoseMessage>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  /** Khung xương mới nhất từ camera (ref: cập nhật 8 lần mỗi giây mà không vẽ lại trang). */
  const latest = useRef<PoseDetection | null>(null);
  /** Camera báo một khung xương mới (dùng khi ghi mẫu). */
  const noteDetection = useCallback((d: PoseDetection) => {
    latest.current = d;
  }, []);

  /** Bật camera ở một nơi (tắt ở nơi kia nếu đang mở), hoặc tắt hẳn. */
  const setCamera = (host: CameraHost | null) => {
    latest.current = null;
    setCameraState(host);
  };

  const run = async (task: () => Promise<string | null>): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      const info = await task();
      await onChanged();
      if (info) setMessage({ kind: 'info', text: info });
      return true;
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: t('pose.data.error', { message: getErrorMessage(err) }) });
      return false;
    } finally {
      setBusy(false);
      setCountdown(null);
    }
  };

  const save = (classId: string, source: 'webcam' | 'upload', detections: PoseDetection[]) =>
    repo.addPoses(detections.map((d) => ({ projectId, classId, kind, source, keypoints: d.keypoints, width: d.width, height: d.height })));

  const record = (classId: string, count: number) =>
    run(async () => {
      if (count > 1) {
        for (let s = COUNTDOWN_SECONDS; s > 0; s--) {
          setCountdown(s);
          await wait(1000);
        }
        setCountdown(0);
      }
      const taken: PoseDetection[] = [];
      let skipped = 0;
      for (let i = 0; i < count; i++) {
        const d = latest.current;
        if (d && usable(kind, d)) taken.push(d);
        else skipped++;
        if (i < count - 1) await wait(BURST_INTERVAL_MS);
      }
      if (taken.length > 0) await save(classId, 'webcam', taken);
      return t('pose.data.recorded', { n: taken.length, skipped });
    });

  const upload = (classId: string, files: readonly File[]) =>
    run(async () => {
      const detect = await loadDetector(kind);
      const found: PoseDetection[] = [];
      let skipped = 0;
      for (const file of files) {
        const frame = grabFrame(await imageFromFile(file), false);
        const d = frame ? await detect(frame) : null;
        if (d && usable(kind, d)) found.push(d);
        else skipped++;
      }
      if (found.length > 0) await save(classId, 'upload', found);
      return t('pose.data.uploaded', { n: found.length, skipped });
    });

  const loadSamples = () =>
    run(async () => {
      const names = (kind === 'body' ? BODY_POSES : HAND_POSES) as readonly string[];
      const ids: Record<string, string> = {};
      for (const pose of names) ids[pose] = (await dataset.addClass(projectId, t(`pose.samples.${pose}`))).id;
      await repo.addPoses(poseDataset(kind).map((p) => ({ projectId, classId: ids[p.pose] as string, kind, source: 'dataset' as const, keypoints: p.keypoints, width: 640, height: 480 })));
      return null;
    });

  /** Thêm "Nhóm n" (số tăng dần, không trùng tên đã có). */
  const addClass = () =>
    run(async () => {
      await dataset.addClass(projectId, nextClassName(classes.map((c) => c.name), (n) => t('audio.data.defaultClass', { n })));
      return null;
    });

  const rename = (classId: string, name: string) => run(async () => (await dataset.renameClass(classId, name), null));
  const deleteClass = (classId: string) => run(async () => (await dataset.deleteClass(classId), null));
  const deletePose = (poseId: string) => run(async () => (await repo.deletePose(poseId), null));

  return { camera, setCamera, noteDetection, busy, message, countdown, record, upload, loadSamples, addClass, rename, deleteClass, deletePose };
}

export type PoseData = ReturnType<typeof usePoseData>;
