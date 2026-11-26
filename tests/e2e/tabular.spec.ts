import { expect, test } from '@playwright/test';

test('Studio dữ liệu bảng: tạo dự án, nạp chim cánh cụt, huấn luyện hồi quy logistic, dự đoán', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: dùng Chuyên sâu (không có khối làm nhanh, các bước luôn mở).
    window.localStorage.setItem('lup.mode', 'expert');
  });
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Chim cánh cụt E2E');
  await page.getByRole('button', { name: 'Tạo dự án Bảng số mới', exact: true }).click();

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

  // tải notebook Colab dựng lại đúng mô hình này bằng scikit-learn
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải notebook (.ipynb)' }).click()]);
  expect(download.suggestedFilename()).toBe('chim-canh-cut-e2e-lup-machine.ipynb');
  const { readFileSync } = await import('node:fs');
  const nb = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(nb.cells.map((c: { source: string[] }) => c.source.join('')).join('\n')).toContain('LogisticRegression(C=1, max_iter=10000)');
  if (process.env.NOTEBOOK_DIR) await download.saveAs(`${process.env.NOTEBOOK_DIR}/e2e-tabular-penguins.ipynb`);

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

test('Studio bảng số, Khám phá: bảng Iris ở cột 1, huấn luyện nhanh, thử từng dòng Kiểm tra', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Iris nhanh');
  await page.getByRole('button', { name: 'Tạo dự án Bảng số mới', exact: true }).click();

  const quick = page.getByRole('region', { name: 'Dạy máy trong 3 bước' });
  await quick.getByRole('button', { name: /Hoa diên vĩ/ }).click();
  await expect(quick.getByText('150 dòng · 5 cột')).toBeVisible();
  await expect(quick.getByLabel('Máy cần đoán cột')).toHaveValue('Loài');

  await quick.getByRole('button', { name: 'Huấn luyện nhanh' }).click();
  await expect(quick.getByRole('list', { name: 'Các chặng huấn luyện' }).getByText('Máy học: Cây quyết định')).toContainText('(đang làm)');
  await expect(quick.getByText(/^Xong\. Máy đoán đúng \d+% mẫu Kiểm tra\.$/)).toBeVisible({ timeout: 10_000 });

  await quick.getByRole('button', { name: 'Thử một dòng Kiểm tra' }).click();
  await expect(quick.getByText(/^Dòng \d+: Loài thật là /)).toBeVisible();
  await expect(quick.getByRole('list', { name: 'Máy đoán' })).toBeVisible();
});

