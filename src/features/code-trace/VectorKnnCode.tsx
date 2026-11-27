import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { EncodedVector, TrainedVectorModel, VectorData } from '@/core/ml/vector-classifier';
import { HELPERS_PROGRAM } from '@/core/trace/helpers-program';
import { KNN_PREDICT_PROGRAM, traceKnnPredict } from '@/core/trace/tabular-trace';
import { CodeTracePanel } from './CodeTracePanel';

interface VectorKnnCodeProps {
  readonly trained: TrainedVectorModel;
  readonly data: VectorData;
  /** Mẫu đang thử (đã mã hóa); null khi chưa có. */
  readonly encoded: EncodedVector | null;
  /** Lời nhắc khi chưa có mẫu để thử. */
  readonly emptyHint: string;
}

/**
 * Bước 6 của Studio âm thanh / tư thế: chạy `knn_predict.py` với mẫu đang thử và đúng mô hình k-NN vừa huấn luyện
 * (k-NN dùng số gốc: dB hoặc tọa độ đã chuẩn hóa theo thân). Hồi quy logistic thì chỉ ghi chú.
 */
export function VectorKnnCode({ trained, data, encoded, emptyHint }: VectorKnnCodeProps) {
  const { t } = useTranslation();
  const key = encoded ? JSON.stringify(encoded.raw) : null;
  const create = useMemo(() => {
    if (trained.kind !== 'knn' || key === null) return null;
    const x = JSON.parse(key) as number[];
    const seen = new Map<number, number>();
    const names = trained.train.ys.map((y) => {
      const n = (seen.get(y) ?? 0) + 1;
      seen.set(y, n);
      return t('codeTrace.sampleName', { cls: data.classNames[y], n });
    });
    const input = { x, train: trained.train.raw, ys: trained.train.ys, names, k: trained.k, task: 'classification', classNames: data.classNames } as const;
    return () => traceKnnPredict(input);
  }, [trained, data, key, t]);
  if (trained.kind !== 'knn') return <p className="text-sm text-muted">{t('codeTrace.knnOnly')}</p>;
  return <CodeTracePanel program={KNN_PREDICT_PROGRAM} helpers={HELPERS_PROGRAM} create={create} emptyHint={emptyHint} jumpLabel={t('codeTrace.toNextPrint')} />;
}
