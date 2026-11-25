import { expect, test } from '@playwright/test';

test('chế độ trình chiếu: chữ to, ẩn thanh điều hướng và gợi ý nhỏ, con trỏ laser, Esc thoát', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: mở sẵn (Khám phá mặc định thu gọn).
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
  await page.goto('./#/lessons');
  const heading = page.getByRole('heading', { level: 1 });
  const baseSize = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.getByRole('button', { name: 'Trình chiếu', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Điều khiển trình chiếu' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: /điều hướng/i })).toBeHidden();
  // cỡ chữ gốc 16px → 20px (125%); mọi kích thước dùng rem nên phóng to theo
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('20px');
  expect(await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(baseSize);

  await page.keyboard.press('+');
  await expect(page.getByTestId('presentation-scale')).toHaveText('150%');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('24px');

  // con trỏ laser đi theo chuột
  await page.keyboard.press('l');
  await page.mouse.move(400, 300);
  const laser = page.getByTestId('laser-pointer');
  await expect(laser).toHaveCSS('opacity', '1');
  const box = await laser.boundingBox();
  expect(Math.round(box!.x + box!.width / 2)).toBe(400);
  expect(Math.round(box!.y + box!.height / 2)).toBe(300);
  expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe('none');

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await page.screenshot({ path: `${shots}/presentation.png` });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Điều khiển trình chiếu' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: /điều hướng/i })).toBeVisible();
  expect(await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(baseSize, 1);
});
