import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AUDIO } from '@/core/audio/features';
import type { Keypoint } from '@/core/pose/detectors';
import { keypointNames, type PoseKind } from '@/core/pose/features';
import { HELPERS_PROGRAM } from '@/core/trace/helpers-program';
import { AUDIO_POOL_PROGRAM, POSE_FEATURES_PROGRAM, traceAudioPool, tracePoseFeatures } from '@/core/trace/sensor-trace';
import { CodeTracePanel } from './CodeTracePanel';

/** Studio âm thanh, bước 3: gộp ảnh phổ mel của đoạn đang xem thành 160 số. */
export function AudioPoolCode({ db }: { readonly db: readonly Float64Array[] }) {
  const { t } = useTranslation();
  const create = useMemo(() => () => traceAudioPool({ db, segments: AUDIO.timeSegments }), [db]);
  return <CodeTracePanel program={AUDIO_POOL_PROGRAM} helpers={HELPERS_PROGRAM} create={create} jumpLabel={t('codeTrace.toNextPrint')} />;
}

interface PoseFeaturesCodeProps {
  readonly kind: PoseKind;
  readonly keypoints: readonly Keypoint[];
  /** Mẫu có đủ khớp tin cậy (vai, hông hoặc cổ tay, gốc ngón giữa) để chuẩn hóa. */
  readonly canNormalize: boolean;
}

/** Studio tư thế, bước 3: chuẩn hóa tọa độ khớp của mẫu đang xem. */
export function PoseFeaturesCode({ kind, keypoints, canNormalize }: PoseFeaturesCodeProps) {
  const { t } = useTranslation();
  // Mảng khớp được tạo lại mỗi lần vẽ: so theo giá trị để khung mã không bị đặt lại vô cớ.
  const pointsKey = JSON.stringify(keypoints);
  // Tên khớp theo ngôn ngữ đang dùng, giống bảng tọa độ bên cạnh ("vai trái").
  const create = useMemo(() => {
    if (!canNormalize) return null;
    const names = keypointNames(kind).map((id) => t(`pose.joints.${id}`));
    const points = JSON.parse(pointsKey) as Keypoint[];
    return () => tracePoseFeatures({ kind, keypoints: points, names });
  }, [kind, pointsKey, canNormalize, t]);
  return (
    <CodeTracePanel
      program={POSE_FEATURES_PROGRAM}
      helpers={HELPERS_PROGRAM}
      create={create}
      emptyHint={t('pose.code.cannotNormalize')}
      jumpLabel={t('codeTrace.toNextPrint')}
    />
  );
}
