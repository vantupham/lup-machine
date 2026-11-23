import { expect, test } from '@playwright/test';

test('Studio dữ liệu bảng: tạo dự án, nạp chim cánh cụt, huấn luyện hồi quy logistic, dự đoán', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Chim cánh cụt E2E');
  await page.getByRole('radio', { name: /Bảng số/ }).check();
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  await page.getByRole('listitem').filter({ hasText: 'Chim cánh cụt E2E' }).getByRole('link', { name: 'Mở' }).click();

  await page.getByRole('button', { name: /Chim cánh cụt Palmer/ }).click();
  await expect(page.getByTestId('table-size')).toHaveText('344 dòng × 7 cột');
  await expect(page.getByTestId('tabular-issues')).toContainText('11 dòng bị bỏ');

  await page.getByRole('radio', { name: /Hồi quy logistic/ }).check();
  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(page.getByTestId('tabular-confusion')).toBeVisible();

  // chim mỏ dài, mỏ mỏng, cánh dài, nặng → Gentoo
  const form = page.getByRole('form', { name: 'Giá trị của dòng mới' });
  await form.getByLabel('Dài mỏ (mm)').fill('47');
  await form.getByLabel('Dày mỏ (mm)').fill('14,5');
  await form.getByLabel('Dài cánh (mm)').fill('217');
  await form.getByLabel('Cân nặng (g)').fill('5200');
  await expect(page.getByTestId('tabular-prediction')).toHaveText(/Gentoo/);

  // mở lại trang: bảng và cấu hình vẫn còn (lưu trên máy)
  await page.reload();
  await expect(page.getByTestId('table-size')).toHaveText('344 dòng × 7 cột');
  await expect(page.getByRole('radio', { name: /Hồi quy logistic/ })).toBeChecked();

  const dir = process.env.SCREENSHOT_DIR;
  if (dir) {
    await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
    await page.screenshot({ path: `${dir}/tabular-penguins.png`, fullPage: true });
  }
});
