import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FEATURE_LENGTH, AUDIO } from '@/core/audio/features';
import type { TrainedVectorModel, VectorData } from '@/core/ml/vector-classifier';
import { keypointNames, type PoseKind } from '@/core/pose/features';
import type { TrainedModel } from '@/core/tabular/models';
import type { PreparedData } from '@/core/tabular/prepare';
import { encodeText, type TextData, type TrainedText } from '@/core/text/text-model';
import { LogisticGrowth } from './LogisticGrowth';
import { TreeGrowth } from './TreeGrowth';

/** Bảng số: cây mọc từng nút, hoặc các vòng lặp của hồi quy logistic (trên dữ liệu đã chuẩn hóa, như khi huấn luyện). */
export function TabularGrowth({ trained, data, c }: { readonly trained: TrainedModel; readonly data: PreparedData; readonly c: number }) {
  if (trained.kind === 'tree') {
    return <TreeGrowth tree={trained.tree} xs={data.train.raw} ys={data.train.y} featureNames={data.featureNames} classNames={data.classNames} />;
  }
  if (trained.kind === 'logistic') {
    return <LogisticGrowth xs={data.train.scaled} ys={data.train.y} numClasses={data.classNames.length} c={c} classNames={data.classNames} featureNames={data.featureNames} />;
  }
  return null;
}

/** Văn bản: các vòng lặp của hồi quy logistic trên TF-IDF (Naive Bayes chỉ đếm một lần, không có vòng lặp). */
export function TextGrowth({ trained, data, c }: { readonly trained: TrainedText | null; readonly data: TextData; readonly c: number }) {
  const xs = useMemo(() => (trained?.kind === 'logistic' ? data.train.texts.map((text) => encodeText(data, text).tfidf) : null), [trained, data]);
  if (!xs) return null;
  return <LogisticGrowth xs={xs} ys={data.train.y} numClasses={data.classNames.length} c={c} classNames={data.classNames} featureNames={data.vocab.terms} />;
}

/** Âm thanh / tư thế: các vòng lặp của hồi quy logistic trên đặc trưng đã chuẩn hóa. */
export function VectorGrowth({ trained, data, c, featureNames }: { readonly trained: TrainedVectorModel | null; readonly data: VectorData; readonly c: number; readonly featureNames: readonly string[] }) {
  if (trained?.kind !== 'logistic') return null;
  return <LogisticGrowth xs={data.train.xs} ys={data.train.ys} numClasses={data.classNames.length} c={c} classNames={data.classNames} featureNames={featureNames} />;
}

/** Tên 160 đặc trưng âm thanh: số thứ s·40 + m là "dải m, phần s". */
export function useAudioFeatureNames(): string[] {
  const { t } = useTranslation();
  return useMemo(
    () => Array.from({ length: FEATURE_LENGTH }, (_, i) => t('growth.audioFeature', { band: (i % AUDIO.nMels) + 1, part: Math.floor(i / AUDIO.nMels) + 1 })),
    [t],
  );
}

/** Tên đặc trưng tư thế: mỗi khớp hai số x, y. */
export function usePoseFeatureNames(kind: PoseKind): string[] {
  const { t } = useTranslation();
  return useMemo(() => keypointNames(kind).flatMap((id) => [`${t(`pose.joints.${id}`)} x`, `${t(`pose.joints.${id}`)} y`]), [kind, t]);
}
