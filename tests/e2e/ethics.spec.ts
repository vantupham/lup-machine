import { expect, test } from '@playwright/test';

const percent = async (locator: import('@playwright/test').Locator) => Number((await locator.textContent())?.match(/(\d+)%/)?.[1]);

test('Phòng đạo đức AI: dữ liệu lệch làm AI kém với Miền núi; thêm dữ liệu và bối cảnh thì công bằng hơn', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: mở sẵn (Khám phá mặc định thu gọn).
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Đạo đức AI' }).click();

  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await page.getByRole('radio', { name: 'Ít hơn' }).check();
  await page.getByRole('button', { name: 'Xem độ chính xác theo từng vùng' }).click();
  const lowland = page.getByTestId('score-lowland');
  const mountain = page.getByTestId('score-mountain');
  expect((await percent(lowland)) - (await percent(mountain))).toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId('boundary-lowland')).toBeVisible();

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await page.getByRole('region', { name: /AI có công bằng/ }).screenshot({ path: `${shots}/ethics-biased.png` });

  await page.getByRole('button', { name: 'Thu thêm 200 lá Miền núi rồi huấn luyện lại' }).click();
  await page.getByRole('button', { name: 'Thêm cột "ở Miền núi" rồi huấn luyện lại' }).click();
  expect(await percent(lowland)).toBeGreaterThanOrEqual(90);
  expect(await percent(mountain)).toBeGreaterThanOrEqual(90);
  await expect(page.getByTestId('boundary-mountain')).toBeVisible();
  if (shots) await page.getByRole('region', { name: /AI có công bằng/ }).screenshot({ path: `${shots}/ethics-region.png` });

  await expect(page.getByRole('heading', { name: 'Dữ liệu của em đi đâu?' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(4);
});
