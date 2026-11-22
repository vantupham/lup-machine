import { expect, test } from '@playwright/test';

/**
 * Chạy ngoại tuyến (phòng máy mất mạng): sau lần mở đầu có mạng, tắt mạng hoàn toàn
 * rồi tải lại trang — vẫn tạo được dự án mẫu và chạy MobileNet thật từ bộ nhớ đệm.
 */
test('mất mạng sau lần mở đầu: vẫn mở trang, tạo dự án mẫu và trích đặc trưng', async ({ page, context }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));

  await page.goto('./');
  await expect(page.getByTestId('offline-status')).toContainText('dùng được cả khi mất mạng', { timeout: 60_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('./#/lessons/ai-hoc-nham');
  await page.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Thử thách: AI học nhầm điều gì?' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Biến ảnh thành vector \(48 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });

  await context.setOffline(false);
  expect(errors).toEqual([]);
});
