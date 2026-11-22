import { useTranslation } from 'react-i18next';
import type { ImageCredit } from '@/storage/db';

/** Dòng ghi công cho ảnh có giấy phép mở: tác giả, nguồn, giấy phép (bắt buộc theo CC BY / MIT). */
export function ImageCreditLine({ credit }: { readonly credit: ImageCredit }) {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-muted" data-testid="image-credit">
      {t('credit.photo')}{' '}
      <a href={credit.source} target="_blank" rel="noopener noreferrer" className="underline">
        {credit.author}
      </a>{' '}
      ·{' '}
      <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {credit.license}
      </a>{' '}
      · {t('credit.changed')}
    </p>
  );
}
