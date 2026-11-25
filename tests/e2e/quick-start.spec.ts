import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('trang chủ: một cú bấm, không gõ phím là vào không gian làm việc dự án ảnh', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Tạo dự án Ảnh mới' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Dự án ảnh 1' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lớp 1' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lớp 2' })).toBeVisible();

  await page.getByRole('link', { name: 'Trang chủ', exact: true }).click();
  const recent = page.getByRole('region', { name: 'Tiếp tục dự án gần đây' });
  await expect(recent.getByRole('link', { name: 'Mở Dự án ảnh 1' })).toBeVisible();
});

test('đường dẫn #/studio/moi/am-thanh tạo đúng một dự án, Quay lại không tạo thêm', async ({ page }) => {
  await page.goto('./#/');
  await page.goto('./#/studio/moi/am-thanh');
  await expect(page.getByRole('heading', { level: 1, name: 'Dự án âm thanh 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dùng âm thanh mẫu/ })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('region', { name: 'Em muốn dạy máy nhận ra gì?' })).toBeVisible();
  await page.goto('./#/studio');
  await expect(page.getByRole('list', { name: 'Dự án của em' }).getByRole('listitem')).toHaveCount(1);
});

test('điện thoại: thẻ loại dự án hiện đủ, không cuộn ngang trang', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./#/');
  for (const type of ['Ảnh', 'Âm thanh', 'Tư thế', 'Văn bản', 'Bảng số']) {
    await expect(page.getByRole('button', { name: `Tạo dự án ${type} mới` })).toBeAttached();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('trang dự án: đổi tên tại chỗ, thanh 6 bước dính khi cuộn và đánh dấu bước đã xong', async ({ page }) => {
  await page.goto('./#/studio/moi/van-ban');
  await expect(page.getByRole('heading', { level: 1, name: 'Dự án văn bản 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Đổi tên dự án' }).click();
  await page.getByRole('textbox', { name: 'Tên dự án mới' }).fill('Góp ý căng tin lớp 7A');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Góp ý căng tin lớp 7A' })).toBeVisible();

  const bar = page.getByRole('navigation', { name: 'Các bước của dự án' });
  await expect(bar.getByRole('button', { name: 'Bước 4: Huấn luyện (chưa mở)' })).toBeVisible();
  await page.getByRole('button', { name: /Góp ý căng tin/ }).click();
  await expect(bar.getByRole('button', { name: 'Bước 1: Dữ liệu (đã xong)' })).toBeVisible();

  await bar.getByRole('button', { name: 'Bước 4: Huấn luyện' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Huấn luyện/ })).toBeFocused();
  // Cuộn mượt cần một lúc: chờ thanh dính sát mép trên màn hình.
  await expect.poll(async () => (await bar.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => (await bar.boundingBox())?.y ?? 99).toBeLessThan(2);

  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Bước 4: Huấn luyện (đã xong)' })).toBeVisible();

  await page.goto('./#/studio');
  const card = page.getByRole('listitem', { name: 'Góp ý căng tin lớp 7A' });
  await expect(card).toContainText('Đã có bảng dữ liệu');
});

