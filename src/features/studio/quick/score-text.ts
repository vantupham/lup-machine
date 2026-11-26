import type { TFunction } from 'i18next';

export interface ScoreText {
  /** Số liệu của chặng chấm điểm. */
  readonly detail: string;
  /** Câu kết quả khi xong. */
  readonly result: string;
}

/** Theo độ chính xác: ưu tiên phần Kiểm tra, không có thì phần Huấn luyện. */
export function accuracyScore(t: TFunction, testAccuracy: number | null, trainAccuracy: number | null): ScoreText | null {
  const accuracy = testAccuracy ?? trainAccuracy;
  if (accuracy === null) return null;
  const options = {
    percent: Math.round(accuracy * 100),
    split: t(testAccuracy === null ? 'project.quick.vector.splitTrain' : 'project.quick.vector.splitTest'),
  };
  return { detail: t('project.quick.vector.scoreDetail', options), result: t('project.quick.vector.done', options) };
}

/** Theo R² (hồi quy): ưu tiên phần Kiểm tra; số thập phân theo ngôn ngữ đang dùng. */
export function r2Score(t: TFunction, language: string, testR2: number | null, trainR2: number | null): ScoreText | null {
  const r2 = testR2 ?? trainR2;
  if (r2 === null) return null;
  const options = {
    r2: r2.toLocaleString(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    split: t(testR2 === null ? 'project.quick.vector.splitTrain' : 'project.quick.vector.splitTest'),
  };
  return { detail: t('project.quick.vector.r2Detail', options), result: t('project.quick.vector.r2Done', options) };
}
