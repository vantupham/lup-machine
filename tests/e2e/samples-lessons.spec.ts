import { expect, test, type Page } from '@playwright/test';

/** Kiểm chứng bằng MobileNetV2 thật rằng nội dung bài học nói đúng với những gì học sinh sẽ thấy. */

async function scores(page: Page): Promise<{ train: number; test: number }> {
  // Điểm hiển thị kiểu Việt Nam, ví dụ "97,6%".
  const read = async (id: string) => Number((await page.getByTestId(id).textContent())?.replace(',', '.').replace(/[^\d.]/g, ''));
  return { train: await read('score-train'), test: await read('score-test') };
}

async function extractAndTrain(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Biến ảnh thành vector \(48 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: /^(Bắt đầu huấn luyện|Huấn luyện lại)$/ }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('bài 3 "AI học nhầm": mô hình học theo nền — điểm Dạy cao, điểm Kiểm tra thấp', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./#/lessons/ai-hoc-nham');
  await page.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Thử thách: AI học nhầm điều gì?' })).toBeVisible({ timeout: 30_000 });
  await extractAndTrain(page);

  const trap = await scores(page);
  console.warn(`[bẫy] Dạy ${trap.train}% / Kiểm tra ${trap.test}%`);
  expect(trap.train).toBeGreaterThanOrEqual(95);
  expect(trap.test).toBeLessThanOrEqual(50);
  expect(await page.getByTestId('wrong-ring').count()).toBeGreaterThanOrEqual(6);

  // Bước "sửa dữ liệu" trong bài: chuyển 3/6 ảnh Kiểm tra mỗi lớp sang ngăn Dạy rồi huấn luyện lại.
  for (const name of ['Hình tròn', 'Hình vuông']) {
    const panel = page.getByRole('article', { name });
    await panel.getByRole('tab', { name: /Kiểm tra/ }).click();
    for (let i = 0; i < 3; i++) {
      await panel.getByRole('listitem').first().hover();
      await panel.getByRole('button', { name: /Chuyển sang Dạy/ }).first().click();
      await expect(panel.getByRole('tab', { name: `Kiểm tra (${5 - i})` })).toBeVisible();
    }
  }
  await page.getByRole('button', { name: /^(Bắt đầu huấn luyện|Huấn luyện lại)$/ }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const fixed = await scores(page);
  console.warn(`[sau khi sửa] Dạy ${fixed.train}% / Kiểm tra ${fixed.test}%`);
  test.info().annotations.push({ type: 'scores', description: `bẫy: ${trap.train}/${trap.test} → sau khi sửa: ${fixed.train}/${fixed.test}` });
  expect(fixed.test).toBeGreaterThan(trap.test);

  expect(errors).toEqual([]);
});

test('bộ "Tròn, vuông, tam giác": ảnh vẽ đúng và mô hình học được hình dạng', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./#/studio');
  await page.getByRole('region', { name: /bộ dữ liệu mẫu/i }).getByRole('button', { name: 'Tạo dự án mẫu' }).nth(1).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('article', { name: 'Tam giác' }).getByRole('tab', { name: 'Dạy (18)' })).toBeVisible();

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await page.getByRole('article', { name: 'Hình tròn' }).screenshot({ path: `${shots}/samples.png` });

  await page.getByRole('button', { name: /Biến ảnh thành vector \(72 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const { test: testScore } = await scores(page);
  test.info().annotations.push({ type: 'scores', description: `kiểm tra: ${testScore}%` });
  expect(testScore).toBeGreaterThanOrEqual(60);
});
