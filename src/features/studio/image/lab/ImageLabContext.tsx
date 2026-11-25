import { createContext, useContext, type ReactNode } from 'react';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { useImageLab, type ImageLab } from './useImageLab';

const ImageLabContext = createContext<ImageLab | null>(null);

interface ImageLabProviderProps {
  readonly projectId: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly children: ReactNode;
}

/**
 * Giữ trạng thái học máy (vector, huấn luyện…) cho cả trang dự án ảnh. Mỗi lượt huấn luyện chỉ làm vẽ lại
 * các phần dùng `useImageLabContext` (khối làm nhanh, bước ③–⑥), KHÔNG vẽ lại phần Dữ liệu với hàng trăm ảnh:
 * `children` do trang cha tạo sẵn nên React giữ nguyên chúng.
 */
export function ImageLabProvider({ projectId, classes, samples, children }: ImageLabProviderProps) {
  const lab = useImageLab(projectId, classes, samples);
  return <ImageLabContext.Provider value={lab}>{children}</ImageLabContext.Provider>;
}

export function useImageLabContext(): ImageLab {
  const lab = useContext(ImageLabContext);
  if (!lab) throw new Error('useImageLabContext cần nằm trong ImageLabProvider');
  return lab;
}
