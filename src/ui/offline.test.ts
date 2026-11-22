import { registerServiceWorker, type OfflineStatus } from './offline';

function container(register: () => Promise<unknown>): ServiceWorkerContainer {
  return { register, ready: Promise.resolve({}) } as unknown as ServiceWorkerContainer;
}

describe('registerServiceWorker', () => {
  test('trình duyệt không hỗ trợ: không báo gì (giữ trạng thái "off")', async () => {
    const report = vi.fn();
    await registerServiceWorker(undefined, 'sw.js', report);
    expect(report).not.toHaveBeenCalled();
  });

  test('đăng ký thành công: đang lưu → sẵn sàng', async () => {
    const statuses: OfflineStatus[] = [];
    const register = vi.fn(async () => ({}));
    await registerServiceWorker(container(register), '/lup-machine/sw.js', (s) => statuses.push(s));
    expect(register).toHaveBeenCalledWith('/lup-machine/sw.js');
    expect(statuses).toEqual(['installing', 'ready']);
  });

  test('đăng ký lỗi: báo lỗi, không ném ra ngoài', async () => {
    const statuses: OfflineStatus[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await registerServiceWorker(container(async () => Promise.reject(new Error('SecurityError'))), 'sw.js', (s) => statuses.push(s));
    expect(statuses).toEqual(['installing', 'error']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
