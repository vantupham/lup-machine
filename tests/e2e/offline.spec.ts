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

test('bộ ảnh thật: không lưu sẵn, nhưng đã dùng một lần khi có mạng thì mất mạng vẫn tạo lại được', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  const createFlowers = async () => {
    await page.goto('./#/studio');
    await page
      .getByRole('list', { name: 'Ảnh thật (giấy phép mở)' })
      .getByRole('listitem')
      .filter({ hasText: 'Hoa cúc, hướng dương hay hoa hồng?' })
      .getByRole('button', { name: 'Tạo dự án mẫu' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Hoa cúc, hướng dương hay hoa hồng?' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('article', { name: 'Hoa hồng' })).toContainText('24');
  };

  await page.goto('./');
  await expect(page.getByTestId('offline-status')).toContainText('dùng được cả khi mất mạng', { timeout: 60_000 });
  const precached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = await (await caches.open(keys[0]!)).keys();
    return requests.some((r) => r.url.includes('/datasets/'));
  });
  expect(precached).toBe(false); // không bắt mọi người tải sẵn vài MB ảnh

  await createFlowers();
  await context.setOffline(true);
  await page.reload();
  await createFlowers();
  await context.setOffline(false);
});
