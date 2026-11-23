import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PHOTOS = join(process.cwd(), 'tests', 'fixtures', 'photos');

async function createPoseProject(page: Page, name: string) {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill(name);
  await page.getByRole('radio', { name: /Tư thế/ }).check();
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: name }).getByRole('link', { name: 'Mở' }).click();
}

test('Studio tư thế (cơ thể): MoveNet thật nhận ảnh người đứng, camera chạy, nhận dạng ảnh mới', async ({ page }) => {
  await createPoseProject(page, 'Tư thế E2E');
  await page.getByRole('button', { name: /Dùng tư thế mẫu/ }).click();
  await expect(page.getByTestId('pose-count-3')).toHaveText('15 mẫu');

  // tải ảnh người đứng (phạm vi công cộng) vào nhóm "Đứng nghiêm": MoveNet chạy trong trình duyệt, chỉ lưu tọa độ
  const standing = page.getByTestId('pose-count-3').locator('xpath=ancestor::li[1]');
  await standing.locator('input[type=file]').setInputFiles(join(PHOTOS, 'person-standing.jpg'));
  await expect(page.getByText('Nhận dạng được 1 ảnh; bỏ qua 0 ảnh không thấy rõ.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('pose-count-3')).toHaveText('16 mẫu');

  // camera giả của Chromium: vòng nhận dạng chạy (không có người nên không kiểm tra khớp)
  await page.getByRole('button', { name: 'Bật camera' }).click();
  await expect(page.getByTestId('camera-state')).toHaveText(/Độ tin cậy trung bình của các khớp/, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Tắt camera' }).click();

  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(page.getByTestId('tabular-confusion')).toBeVisible();
  const use = page.getByRole('region', { name: /Sử dụng/ });
  await use.locator('input[type=file]').setInputFiles(join(PHOTOS, 'person-standing.jpg'));
  await expect(page.getByTestId('pose-prediction')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('pose-try-skeleton').locator('circle[data-value]')).toHaveCount(17);

  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pose-body.png`, fullPage: true });
});

test('Studio tư thế (bàn tay): mô hình bàn tay thật nhận ảnh bàn tay', async ({ page }) => {
  await createPoseProject(page, 'Bàn tay E2E');
  await page.getByRole('radio', { name: /Bàn tay/ }).check();
  await page.getByRole('button', { name: /Dùng cử chỉ mẫu/ }).click();
  await expect(page.getByTestId('pose-count-0')).toHaveText('15 mẫu');
  const open = page.getByTestId('pose-count-0').locator('xpath=ancestor::li[1]');
  await open.locator('input[type=file]').setInputFiles(join(PHOTOS, 'open-hand.jpg'));
  await expect(page.getByTestId('pose-count-0')).toHaveText('16 mẫu', { timeout: 30_000 });
  await expect(page.getByTestId('pose-table').getByRole('rowheader')).toHaveCount(21);
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pose-hand.png`, fullPage: true });
});
