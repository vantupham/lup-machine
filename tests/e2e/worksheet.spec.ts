import { expect, test } from '@playwright/test';

/** Phiếu bài tập in ra giấy thật: kể cả khi máy đang ở chế độ tối, bản in vẫn nền trắng chữ đen, không có thanh điều hướng. */
test('in phiếu bài 4 (học sinh và giáo viên) ra PDF A4', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: mở sẵn (Khám phá mặc định thu gọn).
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./#/lessons/bac-si-cay-trong');
  await page.getByRole('link', { name: /Phiếu bài tập in được/ }).click();
  await expect(page.getByRole('article', { name: /Phiếu bài tập/ })).toBeVisible();

  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const colors = await page.evaluate(() => ({
    body: getComputedStyle(document.body).backgroundColor,
    title: getComputedStyle(document.querySelector('article h1')!).color,
  }));
  expect(colors).toEqual({ body: 'rgb(255, 255, 255)', title: 'rgb(0, 0, 0)' });
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeHidden();
  await expect(page.getByRole('button', { name: /In phiếu/ })).toBeHidden();

  const pages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const student = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen', colorScheme: 'dark' });
  await page.getByRole('button', { name: /Bản giáo viên/ }).click();
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const teacher = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  console.warn(`[phiếu] học sinh ${pages(student)} trang, giáo viên ${pages(teacher)} trang`);
  expect(pages(student)).toBeGreaterThanOrEqual(2);
  expect(pages(student)).toBeLessThanOrEqual(4);
  expect(pages(teacher)).toBeLessThanOrEqual(5);

  const dir = process.env.SCREENSHOT_DIR;
  if (dir) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${dir}/phieu-hoc-sinh.pdf`, student);
    writeFileSync(`${dir}/phieu-giao-vien.pdf`, teacher);
  }
});
