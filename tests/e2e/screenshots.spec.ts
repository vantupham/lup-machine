import { test } from '@playwright/test';

/**
 * Chụp màn hình các trang chính để duyệt giao diện bằng mắt (không so sánh tự động).
 * Chạy khi cần: SCREENSHOT_DIR=<thư mục> npx playwright test screenshots
 */
const OUT = process.env.SCREENSHOT_DIR;

test.skip(!OUT, 'Chỉ chạy khi đặt SCREENSHOT_DIR');

test('chụp màn hình trang dự án và Kính hiển vi', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    window.localStorage.setItem('lup.mode', 'expert');
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('./#/');
  await page.screenshot({ path: `${OUT}/home.png`, fullPage: true });

  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Phân loại rác');
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  await page.getByRole('link', { name: 'Mở Phân loại rác' }).click();
  const panel = page.getByRole('article', { name: 'Lớp 1' });
  await panel.getByRole('button', { name: 'Webcam' }).click();
  const snap = page.getByRole('button', { name: 'Chụp 1 ảnh' });
  await snap.click({ timeout: 10_000 });
  for (let i = 0; i < 5; i++) await snap.click();
  await page.getByRole('button', { name: 'Xong' }).click();
  await page.getByText(/Đã thêm/).waitFor();
  await page.screenshot({ path: `${OUT}/project.png`, fullPage: true });

  await panel.getByRole('button', { name: /Soi ảnh/ }).first().click();
  await page.getByRole('dialog').getByRole('img').waitFor();
  await page.screenshot({ path: `${OUT}/inspector.png` });
});
