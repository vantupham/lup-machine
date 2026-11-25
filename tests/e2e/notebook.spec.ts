import { expect, test } from '@playwright/test';

test('Sổ tay: ghi chép ở từng bước, còn sau khi tải lại, đi theo tệp .lup', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Sổ tay mèo chó');
  await page.getByRole('button', { name: 'Tạo dự án Ảnh mới', exact: true }).click();

  const represent = page.getByTestId('notebook-represent');
  await represent.getByRole('button', { name: /Sổ tay · 2 câu hỏi/ }).click();
  await expect(represent).toContainText('lớp nào tách riêng, lớp nào nằm lẫn vào nhau');
  await represent.getByLabel('Ghi chép của em').fill('Mèo đen nằm lẫn vào nhóm chó');
  await represent.getByLabel('Ghi chép của em').blur();
  await expect(represent.getByText('Đã lưu')).toBeVisible();

  await page.reload();
  const reloaded = page.getByTestId('notebook-represent');
  await reloaded.getByRole('button', { name: /Sổ tay · đã ghi/ }).click();
  await expect(reloaded.getByLabel('Ghi chép của em')).toHaveValue('Mèo đen nằm lẫn vào nhóm chó');

  // mang sang "máy khác": xuất, xóa, mở lại tệp
  await page.goto('./#/studio');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất tệp dự án Sổ tay mèo chó', exact: true }).click()]);
  await page.getByRole('button', { name: 'Xóa Sổ tay mèo chó', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Mở tệp dự án' });
  await panel.getByLabel('Chọn tệp .lup').setInputFiles((await download.path())!);
  await panel.getByRole('link', { name: 'Mở dự án', exact: true }).click();
  const imported = page.getByTestId('notebook-represent');
  await imported.getByRole('button', { name: /Sổ tay · đã ghi/ }).click();
  await expect(imported.getByLabel('Ghi chép của em')).toHaveValue('Mèo đen nằm lẫn vào nhóm chó');
});
