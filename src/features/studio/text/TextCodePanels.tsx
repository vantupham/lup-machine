import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HELPERS_PROGRAM } from '@/core/trace/helpers-program';
import {
  NAIVE_BAYES_PROGRAM,
  TEXT_PREDICT_PROGRAM,
  TEXT_VECTORIZE_PROGRAM,
  traceNaiveBayes,
  traceTextPredict,
  traceVectorize,
} from '@/core/trace/text-trace';
import { encodeText, type TextData, type TrainedText } from '@/core/text/text-model';
import { CodeTracePanel } from '@/features/code-trace/CodeTracePanel';

/** Bước 3: câu đang thử → TF-IDF, đúng như bảng bên cạnh. */
export function VectorizeCode({ data, sentence }: { readonly data: TextData; readonly sentence: string }) {
  const { t } = useTranslation();
  const create = useMemo(() => () => traceVectorize({ sentence, maxN: data.maxN, vocab: data.vocab }), [sentence, data]);
  return <CodeTracePanel program={TEXT_VECTORIZE_PROGRAM} helpers={HELPERS_PROGRAM} create={create} jumpLabel={t('codeTrace.toNextPrint')} />;
}

/** Bước 4: huấn luyện Naive Bayes từng dòng (hồi quy logistic dùng L-BFGS: quá nhiều phép tính để chạy từng dòng). */
export function NaiveBayesCode({ data, trained }: { readonly data: TextData; readonly trained: TrainedText | null }) {
  const { t } = useTranslation();
  const create = useMemo(() => {
    if (trained?.kind !== 'naive-bayes') return null;
    const counts = data.train.texts.map((text) => encodeText(data, text).counts);
    const input = { counts, ys: data.train.y, vocab: data.vocab.terms, classNames: data.classNames, alpha: trained.model.alpha };
    return () => traceNaiveBayes(input);
  }, [data, trained]);
  return (
    <CodeTracePanel
      program={NAIVE_BAYES_PROGRAM}
      helpers={HELPERS_PROGRAM}
      create={create}
      emptyHint={t(trained?.kind === 'logistic' ? 'text.code.logisticOnly' : 'codeTrace.needRun')}
      jumpLabel={t('codeTrace.toNextPrint')}
    />
  );
}

/** Bước 6: đoán câu đang gõ bằng mô hình Naive Bayes vừa huấn luyện. */
export function TextPredictCode({ data, trained, sentence }: { readonly data: TextData; readonly trained: TrainedText; readonly sentence: string }) {
  const { t } = useTranslation();
  const create = useMemo(() => {
    if (trained.kind !== 'naive-bayes') return null;
    const { classLogPrior, featureLogProb } = trained.model;
    return () => traceTextPredict({ sentence, maxN: data.maxN, vocab: data.vocab, classLogPrior, featureLogProb, classNames: data.classNames });
  }, [data, trained, sentence]);
  return (
    <CodeTracePanel
      program={TEXT_PREDICT_PROGRAM}
      helpers={HELPERS_PROGRAM}
      create={create}
      emptyHint={t('text.code.logisticOnly')}
      jumpLabel={t('codeTrace.toNextPrint')}
    />
  );
}
