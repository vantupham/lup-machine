import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HELPERS_PROGRAM } from '@/core/trace/helpers-program';
import {
  KNN_PREDICT_PROGRAM,
  LINEAR_PREDICT_PROGRAM,
  TABULAR_SCALE_PROGRAM,
  TREE_PREDICT_PROGRAM,
  traceKnnPredict,
  traceLinearPredict,
  traceScale,
  traceTreePredict,
} from '@/core/trace/tabular-trace';
import type { TrainedModel } from '@/core/tabular/models';
import type { PreparedData } from '@/core/tabular/prepare';
import { CodeTracePanel } from '@/features/code-trace/CodeTracePanel';
import type { TraceFactory } from '@/features/code-trace/useTracePlayer';

/** Vị trí (trong vector gốc) và tên của các cột số; cột chữ đã thành nhiều cột 0/1 nên bỏ qua. */
function numericColumns(data: PreparedData): { readonly index: number; readonly name: string }[] {
  let offset = 0;
  return data.encoders.flatMap((e) => {
    const at = offset;
    offset += e.kind === 'numeric' ? 1 : e.categories.length;
    return e.kind === 'numeric' ? [{ index: at, name: e.name }] : [];
  });
}

/** Bước 3: chuẩn hóa các cột số (giống bộ mã hóa của trang, tính trên tập Huấn luyện). */
export function ScaleCode({ data }: { readonly data: PreparedData }) {
  const { t } = useTranslation();
  const create = useMemo(() => {
    const columns = numericColumns(data);
    if (columns.length === 0 || data.train.raw.length === 0) return null;
    const rows = data.train.raw.map((r) => columns.map((c) => r[c.index]!));
    return () => traceScale({ rows, columns: columns.map((c) => c.name) });
  }, [data]);
  return (
    <CodeTracePanel
      program={TABULAR_SCALE_PROGRAM}
      helpers={HELPERS_PROGRAM}
      create={create}
      emptyHint={t('tabular.code.noNumeric')}
      jumpLabel={t('codeTrace.toNextPrint')}
    />
  );
}

const PROGRAMS = { tree: TREE_PREDICT_PROGRAM, knn: KNN_PREDICT_PROGRAM, 'knn-regression': KNN_PREDICT_PROGRAM, linear: LINEAR_PREDICT_PROGRAM, logistic: null } as const;

function factoryFor(trained: TrainedModel, data: PreparedData, row: { raw: number[]; scaled: number[] }, rowName: (n: number) => string): TraceFactory | null {
  switch (trained.kind) {
    case 'tree':
      return () => traceTreePredict({ x: row.raw, tree: trained.tree, features: data.featureNames, classNames: data.classNames });
    case 'knn':
    case 'knn-regression': {
      const task = trained.kind === 'knn' ? 'classification' : 'regression';
      const names = trained.train.rowNumbers.map((n) => rowName(n));
      const input = { x: row.scaled, train: trained.train.scaled, ys: trained.train.y, names, k: trained.k, task, classNames: data.classNames } as const;
      return () => traceKnnPredict(input);
    }
    case 'linear':
      return () => traceLinearPredict({ x: row.raw, model: trained.model, features: data.featureNames });
    case 'logistic':
      return null;
  }
}

/** Bước 6: đoán dòng đang thử, từng dòng mã, bằng đúng mô hình vừa huấn luyện. */
export function PredictCode({ trained, data, row }: { readonly trained: TrainedModel; readonly data: PreparedData; readonly row: { raw: number[]; scaled: number[] } | null }) {
  const { t } = useTranslation();
  // Dòng đang thử là đối tượng mới sau mỗi lần vẽ: so theo giá trị để khung mã không bị đặt lại vô cớ.
  const rowKey = row ? JSON.stringify(row) : null;
  const create = useMemo(
    () => (rowKey === null ? null : factoryFor(trained, data, JSON.parse(rowKey) as { raw: number[]; scaled: number[] }, (n) => t('tabular.code.rowName', { n }))),
    [trained, data, rowKey, t],
  );
  const program = PROGRAMS[trained.kind];
  if (!program) return <p className="text-sm text-muted">{t('tabular.code.logisticOnly')}</p>;
  return (
    <CodeTracePanel
      program={program}
      helpers={HELPERS_PROGRAM}
      create={create}
      emptyHint={t('tabular.code.invalidRow')}
      jumpLabel={t('codeTrace.toNextPrint')}
    />
  );
}
