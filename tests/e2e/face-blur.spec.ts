import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const FACE_PHOTO = join(process.cwd(), 'tests', 'fixtures', 'photos', 'person-face.jpg');

/**
 * Độ chi tiết vùng giữa ảnh (nơi có khuôn mặt): tổng chênh lệch độ sáng giữa các điểm ảnh liền kề.
 * Ảnh đã pixel hóa gồm các ô một màu nên chỉ số này thấp hơn hẳn ảnh gốc.
 */
async function centerDetail(page: Page, index: number): Promise<number> {
  const img = page.getByRole('article', { name: 'Lớp 1' }).locator('img').nth(index);
  await expect(img).toBeVisible();
  return img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(el, 0, 0, 224, 224);
    const { data } = ctx.getImageData(72, 56, 80, 100);
    const lum = (i: number) => data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
    let sum = 0;
    for (let y = 0; y < 100; y++) for (let x = 1; x < 80; x++) sum += Math.abs(lum((y * 80 + x) * 4) - lum((y * 80 + x - 1) * 4));
    return sum / (100 * 79);
  });
}

test('làm mờ khuôn mặt: bật thì ảnh lưu đã bị pixel hóa, tắt thì giữ nguyên chi tiết', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: mở sẵn (Khám phá mặc định thu gọn).
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Quyền riêng tư');
  await page.getByRole('button', { name: 'Tạo dự án Ảnh mới', exact: true }).click();

  const toggle = page.getByRole('checkbox', { name: 'Làm mờ khuôn mặt trước khi lưu ảnh' });
  await expect(toggle).toBeChecked();
  const upload = page.getByRole('article', { name: 'Lớp 1' }).locator('input[type="file"]').first();
  await upload.setInputFiles(FACE_PHOTO);
  await expect(page.getByRole('article', { name: 'Lớp 1' }).locator('img')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByText(/Đã làm mờ 1 khuôn mặt\./)).toBeVisible();
  const blurred = await centerDetail(page, 0);

  await toggle.uncheck();
  await upload.setInputFiles(FACE_PHOTO);
  await expect(page.getByRole('article', { name: 'Lớp 1' }).locator('img')).toHaveCount(2, { timeout: 30_000 });
  const original = await centerDetail(page, 1);

  test.info().annotations.push({ type: 'detail', description: `làm mờ ${blurred.toFixed(2)} / gốc ${original.toFixed(2)}` });
  expect(blurred).toBeLessThan(original * 0.5);

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await page.getByRole('article', { name: 'Lớp 1' }).screenshot({ path: `${shots}/face-blur.png` });
});
