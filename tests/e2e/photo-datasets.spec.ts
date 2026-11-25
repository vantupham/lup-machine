import { expect, test, type Page } from '@playwright/test';

/** Kiểm chứng bằng MobileNetV2 thật những gì thẻ bộ ảnh thật nói với học sinh. */

async function createAndTrain(page: Page, cardTitle: string): Promise<{ train: number; test: number }> {
  await page.goto('./#/studio');
  const photos = page.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' });
  await photos.getByRole('listitem').filter({ hasText: cardTitle }).getByRole('button', { name: 'Tạo dự án mẫu' }).click();
  await expect(page.getByRole('heading', { level: 1, name: cardTitle })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Biến ảnh thành vector \(90 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const read = async (id: string) => Number((await page.getByTestId(id).textContent())?.replace(',', '.').replace(/[^\d.]/g, ''));
  return { train: await read('score-train'), test: await read('score-test') };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('bộ hoa: ảnh thật, mô hình học tốt; ảnh mang ghi công tác giả', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const flowers = await createAndTrain(page, 'Hoa cúc, hướng dương hay hoa hồng?');
  console.warn(`[hoa] Dạy ${flowers.train}% / Kiểm tra ${flowers.test}%`);
  expect(flowers.test).toBeGreaterThanOrEqual(80);

  await page.getByRole('group', { name: 'Bản đồ dữ liệu 2D' }).getByRole('button').first().click();
  const credit = page.getByTestId('selected-detail').getByTestId('image-credit');
  await expect(credit).toContainText('CC BY 2.0');
  await expect(credit.getByRole('link').first()).toHaveAttribute('href', /^https:\/\/www\.flickr\.com\/photos\//);

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) {
    await page.getByRole('region', { name: 'Biểu diễn', exact: true }).screenshot({ path: `${shots}/flowers-map.png` });
    await page.goto('./#/studio');
    await page.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' }).screenshot({ path: `${shots}/photo-cards.png` });
  }
  expect(errors).toEqual([]);
});

test('bộ lá đậu: bài toán thật khó hơn bộ hoa (điểm Kiểm tra thấp hơn)', async ({ page }) => {
  test.setTimeout(240_000);
  const beans = await createAndTrain(page, 'Bác sĩ lá đậu: khỏe, đốm góc hay gỉ sắt?');
  console.warn(`[lá đậu] Dạy ${beans.train}% / Kiểm tra ${beans.test}%`);
  expect(beans.test).toBeGreaterThan(40); // học được thật, tốt hơn đoán bừa (33%)
  expect(beans.test).toBeLessThan(95); // nhưng chưa hoàn hảo — đúng như thẻ mô tả "khó hơn"
});
