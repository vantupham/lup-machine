import { useEffect, useMemo } from 'react';
import type { StoredImage } from '@/storage/db';

/** Tạo URL tạm cho ảnh đã lưu và thu hồi khi không dùng nữa (tránh rò rỉ bộ nhớ). */
export function useObjectUrl(image: StoredImage): string {
  const url = useMemo(
    () => URL.createObjectURL(new Blob([image.bytes], { type: image.mime })),
    [image],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}
