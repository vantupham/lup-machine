import { expect, test, type Page } from '@playwright/test';

async function screenshot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('k-NN: bấm vào hình để đặt điểm cần đoán, phiếu bầu cập nhật', async ({ page }) => {
  await page.goto('./#/playground');
  await page.getByRole('link', { name: /k láng giềng gần nhất/ }).click();
  const plot = page.getByRole('img', { name: /vùng màu là lớp k-NN dự đoán/ });
  await expect(plot).toBeVisible();
  const box = (await plot.boundingBox())!;
  // góc dưới trái thuộc đám mây lớp 1 (tâm −0.5, −0.4)
  await plot.click({ position: { x: box.width * 0.3, y: box.height * 0.67 } });
  await expect(page.getByText(/được đoán là Lớp 1/)).toBeVisible();
  await screenshot(page, 'playground-knn');
});

test('cây quyết định mọc từng nút; mạng nơ-ron huấn luyện làm loss giảm', async ({ page }) => {
  await page.goto('./#/playground/decision-tree');
  await page.getByRole('button', { name: 'Trồng lại từ gốc' }).click();
  await page.getByRole('button', { name: 'Mọc thêm một nút' }).click();
  await page.getByRole('button', { name: 'Mọc thêm một nút' }).click();
  await expect(page.getByText(/Đã mở 2\//)).toBeVisible();
  await screenshot(page, 'playground-tree');

  await page.goto('./#/playground/neural-network');
  const train = page.getByRole('button', { name: /Huấn luyện 5 bước/ });
  await train.click();
  const loss = page.getByText('loss', { exact: true }).locator('xpath=following-sibling::dd');
  const first = Number(await loss.textContent());
  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(page.getByText('Số bước', { exact: true }).locator('xpath=following-sibling::dd')).not.toHaveText(/^(5|10|15|20)$/, { timeout: 10_000 });
  await page.getByRole('button', { name: 'Tạm dừng' }).click();
  expect(Number(await loss.textContent())).toBeLessThan(first);
  await screenshot(page, 'playground-neural');
});

test('gradient descent và k-means chạy tới cuối', async ({ page }) => {
  await page.goto('./#/playground/gradient-descent');
  await page.getByRole('button', { name: 'Chạy' }).click();
  await expect(page.getByRole('heading', { name: 'Bước 60' })).toBeVisible({ timeout: 20_000 });
  await screenshot(page, 'playground-gradient');

  await page.goto('./#/playground/k-means');
  await page.getByRole('button', { name: 'Chạy' }).click();
  await expect(page.getByText(/thuật toán dừng \(hội tụ\)/)).toBeVisible({ timeout: 30_000 });
  await screenshot(page, 'playground-kmeans');
});
