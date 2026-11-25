import { expect, test } from '@playwright/test';

test('Thẻ mô hình: điền từ studio, còn sau khi tải lại, đi theo tệp .lup', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: mở sẵn (Khám phá mặc định thu gọn).
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Ý kiến căng tin');
  await page.getByRole('button', { name: 'Tạo dự án Văn bản mới', exact: true }).click();

  await page.getByRole('link', { name: /Thẻ mô hình · chưa điền đủ/ }).click();
  await expect(page.getByTestId('model-card-facts')).toContainText('Loại dự án: Văn bản');
  await page.getByLabel('Người làm').fill('Nhóm 4');
  await page.getByLabel(/Mô hình dùng để làm gì/).fill('Phân loại ý kiến khen / chê về căng tin');
  await page.getByLabel(/Dữ liệu lấy từ đâu/).fill('Phiếu góp ý của học sinh, đã bỏ tên');
  await page.getByLabel(/Mô hình làm tốt đến đâu/).fill('Đúng khoảng 80% câu Kiểm tra');
  await page.getByLabel(/Khi nào mô hình dễ sai/).fill('Câu mỉa mai, câu viết không dấu');
  await page.getByLabel(/Không nên dùng/).fill('Đánh giá nhân viên căng tin');
  await page.getByRole('button', { name: 'Lưu thẻ' }).click();
  await expect(page.getByTestId('model-card-completeness')).toHaveText(/Đã trả lời đủ 5 câu hỏi/);

  await page.reload();
  await expect(page.getByLabel(/Khi nào mô hình dễ sai/)).toHaveValue('Câu mỉa mai, câu viết không dấu');

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await page.screenshot({ path: `${shots}/model-card.png`, fullPage: true });

  await page.getByRole('link', { name: 'Quay lại dự án', exact: false }).click();
  await expect(page.getByRole('link', { name: /Thẻ mô hình · đã điền đủ/ })).toBeVisible();

  // mang sang "máy khác": xuất, xóa, mở lại tệp
  await page.goto('./#/studio');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất tệp dự án Ý kiến căng tin', exact: true }).click()]);
  await page.getByRole('button', { name: 'Xóa Ý kiến căng tin', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Mở tệp dự án' });
  await panel.getByLabel('Chọn tệp .lup').setInputFiles((await download.path())!);
  await panel.getByRole('link', { name: 'Mở dự án', exact: true }).click();
  await page.getByRole('link', { name: /Thẻ mô hình · đã điền đủ/ }).click();
  await expect(page.getByLabel('Người làm')).toHaveValue('Nhóm 4');
  await expect(page.getByLabel(/Không nên dùng/)).toHaveValue('Đánh giá nhân viên căng tin');
});
