import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useModelCardRepository } from '@/storage/repository-context';
import { isModelCardComplete } from '@/storage/schemas/model-card';
import { Check, Pencil } from '@/ui/icons';

interface ModelCardLinkProps {
  readonly projectId: string;
}

/** Liên kết tới Thẻ mô hình, cho biết thẻ đã điền đủ chưa. */
export function ModelCardLink({ projectId }: ModelCardLinkProps) {
  const { t } = useTranslation();
  const cards = useModelCardRepository();
  const [status, setStatus] = useState<{ id: string; complete: boolean } | null>(null);

  useEffect(() => {
    let isActive = true;
    cards.get(projectId).then(
      (card) => isActive && setStatus({ id: projectId, complete: isModelCardComplete(card) }),
      () => isActive && setStatus({ id: projectId, complete: false }),
    );
    return () => {
      isActive = false;
    };
  }, [cards, projectId]);

  const complete = status?.id === projectId && status.complete;
  return (
    <Link
      to={`/studio/${projectId}/the-mo-hinh`}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-surface ${complete ? 'border-accent text-accent' : 'border-rule text-ink'}`}
    >
      {complete ? <Check /> : <Pencil />}
      {complete ? t('modelCard.linkComplete') : t('modelCard.linkIncomplete')}
    </Link>
  );
}
