import { expect, test } from '@playwright/test';

test('Studio văn bản: bộ góp ý căng tin, huấn luyện, giải thích từng từ, tải notebook', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: dùng Chuyên sâu (không có khối làm nhanh, các bước luôn mở).
    window.localStorage.setItem('lup.mode', 'expert');
  });
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Căng tin E2E');
  await page.getByRole('button', { name: 'Tạo dự án Văn bản mới', exact: true }).click();

  await page.getByRole('button', { name: /Góp ý căng tin/ }).click();
  await expect(page.getByTestId('text-size')).toHaveText('80 câu · 2 nhóm');
  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(page.getByTestId('tabular-confusion')).toBeVisible();

  await page.getByLabel('Gõ một câu').fill('Cơm ngon, cô bán hàng vui vẻ.');
  await expect(page.getByTestId('text-prediction')).toHaveText(/khen/);
  await page.getByLabel('Gõ một câu').fill('Phải chờ rất lâu, bàn ăn bẩn.');
  await expect(page.getByTestId('text-prediction')).toHaveText(/chê/);
  // "bẩn" đẩy câu về nhóm chê: được tô màu (đóng góp dương cho nhóm máy đoán)
  const dirty = page.getByTestId('text-highlight').locator('mark', { hasText: 'bẩn' });
  expect(Number(await dirty.getAttribute('data-value'))).toBeGreaterThan(0);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải notebook (.ipynb)' }).click()]);
  expect(download.suggestedFilename()).toBe('cang-tin-e2e-lup-machine.ipynb');
  if (process.env.NOTEBOOK_DIR) await download.saveAs(`${process.env.NOTEBOOK_DIR}/e2e-text-can-tin.ipynb`);

  await page.reload();
  await expect(page.getByTestId('text-size')).toHaveText('80 câu · 2 nhóm');
  if (process.env.SCREENSHOT_DIR) {
    await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
    await page.getByLabel('Gõ một câu').fill('Cơm nguội nhưng cô bán hàng rất vui vẻ.');
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/text-can-tin.png`, fullPage: true });
  }
});

test('Studio văn bản, Khám phá: bộ góp ý căng tin ở cột 1, gõ thêm câu, huấn luyện nhanh, thử một câu', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Căng tin nhanh');
  await page.getByRole('button', { name: 'Tạo dự án Văn bản mới', exact: true }).click();

  const quick = page.getByRole('region', { name: 'Dạy máy trong 3 bước' });
  await quick.getByRole('button', { name: /Góp ý căng tin/ }).click();
  const praise = quick.getByRole('group', { name: 'khen' });
  await expect(praise).toContainText('40 câu');
  await praise.getByLabel('Câu mới cho nhóm khen').fill('Cơm hôm nay thơm và nóng hổi');
  await praise.getByLabel('Câu mới cho nhóm khen').press('Enter');
  await expect(praise).toContainText('41 câu');

  await quick.getByRole('button', { name: 'Huấn luyện nhanh' }).click();
  await expect(quick.getByRole('list', { name: 'Các chặng huấn luyện' }).getByText('Máy học: Naive Bayes')).toContainText('(đang làm)');
  await expect(quick.getByText(/^Xong\. Máy đoán đúng \d+% mẫu Kiểm tra\.$/)).toBeVisible({ timeout: 10_000 });

  await quick.getByLabel('Gõ một câu để thử').fill('đồ ăn ngon, cô bán hàng vui vẻ');
  await expect(quick.getByRole('list', { name: 'Máy đoán' }).getByRole('listitem').first()).toContainText('khen');
});

