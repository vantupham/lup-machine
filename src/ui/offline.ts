import { create } from 'zustand';

/** Trạng thái chạy ngoại tuyến: 'off' = không áp dụng (bản dev hoặc trình duyệt không hỗ trợ). */
export type OfflineStatus = 'off' | 'installing' | 'ready' | 'error';

interface OfflineState {
  readonly status: OfflineStatus;
  setStatus: (status: OfflineStatus) => void;
}

export const useOfflineStore = create<OfflineState>()((set) => ({
  status: 'off',
  setStatus: (status) => set({ status }),
}));

/**
 * Đăng ký service worker (lưu sẵn ứng dụng + mô hình) và báo trạng thái.
 * Lỗi không làm hỏng ứng dụng — chỉ là không dùng được khi mất mạng — nhưng được hiển thị cho người dùng.
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer | undefined,
  scriptUrl: string,
  report: (status: OfflineStatus) => void,
): Promise<void> {
  if (!container) return;
  report('installing');
  try {
    await container.register(scriptUrl);
    await container.ready;
    report('ready');
  } catch (error: unknown) {
    console.error('Không đăng ký được service worker', error);
    report('error');
  }
}
