import { expect, test, type Page } from '@playwright/test';

/** Bấm "Xuất .lup" trên thẻ dự án, trả về đường dẫn tệp đã tải về. */
async function exportProject(page: Page, name: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: `Xuất tệp dự án ${name}`, exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.lup$/);
  return (await download.path())!;
}

async function deleteProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Xóa ${name}`, exact: true }).click();
  await page.getByRole('status').filter({ hasText: `Đã xóa "${name}".` }).getByRole('button', { name: 'Đóng' }).click();
  await expect(page.getByRole('list', { name: 'Dự án của em' }).getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
}

async function importProject(page: Page, file: string, name: string): Promise<void> {
  const panel = page.getByRole('region', { name: 'Mở tệp dự án' });
  await panel.getByLabel('Chọn tệp .lup').setInputFiles(file);
  await expect(panel.getByRole('status')).toHaveText(new RegExp(`Đã mở dự án "${name}"`));
  await panel.getByRole('link', { name: 'Mở dự án', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: dùng Chuyên sâu (không có khối làm nhanh, các bước luôn mở).
    window.localStorage.setItem('lup.mode', 'expert');
  });
});

test('dự án ảnh: xuất .lup, xóa, mở lại tệp → đủ lớp và ảnh hiển thị được', async ({ page }) => {
  await page.goto('./#/studio');
  await page.getByRole('region', { name: /bộ dữ liệu mẫu/i }).getByRole('button', { name: 'Tạo dự án mẫu' }).nth(1).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeVisible({ timeout: 30_000 });

  await page.goto('./#/studio');
  const file = await exportProject(page, 'Tròn, vuông, tam giác');
  await deleteProject(page, 'Tròn, vuông, tam giác');
  await importProject(page, file, 'Tròn, vuông, tam giác');

  await expect(page.getByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeVisible();
  for (const name of ['Hình tròn', 'Hình vuông', 'Tam giác']) {
    await expect(page.getByRole('article', { name }).getByRole('tab', { name: 'Huấn luyện (18)' })).toBeVisible();
  }
  // ảnh JPEG đi qua tệp zip vẫn giải mã được trong trình duyệt
  const firstImage = page.getByRole('article', { name: 'Hình tròn' }).locator('img').first();
  await expect(firstImage).toBeVisible();
  expect(await firstImage.evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth))).toBe(224);
});

test('dự án bảng: bảng dữ liệu và cấu hình mô hình đi theo tệp .lup', async ({ page }) => {
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Cánh cụt mang đi');
  await page.getByRole('button', { name: 'Tạo dự án Bảng số mới', exact: true }).click();
  await page.getByRole('button', { name: /Chim cánh cụt Palmer/ }).click();
  await expect(page.getByTestId('table-size')).toHaveText('344 dòng × 7 cột');
  await page.getByRole('radio', { name: /Hồi quy logistic/ }).check();
  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(page.getByTestId('tabular-confusion')).toBeVisible();

  await page.goto('./#/studio');
  const file = await exportProject(page, 'Cánh cụt mang đi');
  await deleteProject(page, 'Cánh cụt mang đi');
  await importProject(page, file, 'Cánh cụt mang đi');

  await expect(page.getByTestId('table-size')).toHaveText('344 dòng × 7 cột');
  await expect(page.getByRole('radio', { name: /Hồi quy logistic/ })).toBeChecked();
});

test('tệp không phải .lup: báo lỗi, không tạo dự án', async ({ page }) => {
  await page.goto('./#/studio');
  const panel = page.getByRole('region', { name: 'Mở tệp dự án' });
  await panel.getByLabel('Chọn tệp .lup').setInputFiles({ name: 'gia.lup', mimeType: 'application/zip', buffer: Buffer.from('không phải zip') });
  await expect(panel.getByRole('alert')).toContainText('Không mở được tệp');
  await expect(page.getByText('Chưa có dự án nào')).toBeVisible();
});
