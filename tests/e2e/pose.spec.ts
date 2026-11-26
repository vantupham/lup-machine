import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const PHOTOS = join(process.cwd(), 'tests', 'fixtures', 'photos');

async function createPoseProject(page: Page, name: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: dùng Chuyên sâu (không có khối làm nhanh, các bước luôn mở).
    window.localStorage.setItem('lup.mode', 'expert');
  });
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill(name);
  await page.getByRole('button', { name: 'Tạo dự án Tư thế mới', exact: true }).click();
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

test('Studio tư thế, Khám phá: tải ảnh ở cột 1 (MoveNet thật), camera chung, huấn luyện nhanh, thử ảnh ở cột 3', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Tư thế nhanh');
  await page.getByRole('button', { name: 'Tạo dự án Tư thế mới', exact: true }).click();

  const quick = page.getByRole('region', { name: 'Dạy máy trong 3 bước' });
  await quick.getByRole('button', { name: /Dùng tư thế mẫu/ }).click();
  const standing = quick.getByRole('group', { name: 'Đứng nghiêm' });
  await expect(standing.getByText('15 mẫu')).toBeVisible();
  await standing.getByLabel('Tải ảnh cho nhóm Đứng nghiêm').setInputFiles(join(PHOTOS, 'person-standing.jpg'));
  await expect(standing.getByText('16 mẫu')).toBeVisible({ timeout: 30_000 });

  // một camera cho cả khối: bật ở cột 1 thì nút ghi mẫu mở khóa
  await quick.getByRole('button', { name: 'Bật camera' }).click();
  await expect(quick.getByTestId('camera-state')).toHaveText(/Độ tin cậy trung bình của các khớp/, { timeout: 30_000 });
  await expect(standing.getByRole('button', { name: 'Ghi 1 mẫu cho nhóm Đứng nghiêm' })).toBeEnabled();
  await quick.getByRole('button', { name: 'Tắt camera' }).click();

  await quick.getByRole('button', { name: 'Huấn luyện nhanh' }).click();
  await expect(quick.getByRole('list', { name: 'Các chặng huấn luyện' }).getByText('Máy học: Hồi quy logistic')).toContainText('(đang làm)');
  await expect(quick.getByText(/^Xong\. Máy đoán đúng \d+% mẫu Kiểm tra\.$/)).toBeVisible({ timeout: 10_000 });

  await quick.getByLabel('Thử với một ảnh').setInputFiles(join(PHOTOS, 'person-standing.jpg'));
  await expect(quick.getByRole('list', { name: 'Máy đoán' })).toBeVisible({ timeout: 30_000 });
});
