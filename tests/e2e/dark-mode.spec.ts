import { expect, test, type Page } from '@playwright/test';

/** Màu (rgb) phải khớp bảng màu thô trong src/index.css. */
const PAPER = { light: 'rgb(247, 245, 239)', dark: 'rgb(14, 20, 32)' } as const;
const INK = { light: 'rgb(27, 36, 51)', dark: 'rgb(230, 226, 214)' } as const;

async function screenshot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function openPlayground(page: Page, theme?: 'dark') {
  await page.addInitScript((t) => {
    window.localStorage.setItem('lup.language', 'vi');
    // Các spec này thao tác trong 6 bước chi tiết: mở sẵn (Khám phá mặc định thu gọn).
    window.localStorage.setItem('lup.stepDetails', 'open');
    if (t) window.localStorage.setItem('lup.theme', t);
  }, theme);
  await page.goto('./#/playground/k-means');
  await expect(page.locator('input[type="range"]').first()).toBeVisible();
}

function computed(page: Page, selector: string, prop: string): Promise<string> {
  return page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}

async function expectTheme(page: Page, theme: 'light' | 'dark') {
  expect(await computed(page, 'body', 'background-color')).toBe(PAPER[theme]);
  expect(await computed(page, 'body', 'color')).toBe(INK[theme]);
  // color-scheme ở gốc → trình duyệt vẽ thanh cuộn, ô chọn, thanh trượt theo đúng giao diện.
  expect(await computed(page, 'html', 'color-scheme')).toBe(theme);
  expect(await computed(page, 'input[type="range"]', 'color-scheme')).toBe(theme);
}

test('mặc định giao diện sáng, kể cả khi hệ điều hành đang ở chế độ tối', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPlayground(page);
  await expectTheme(page, 'light');
  await expect(page.getByRole('button', { name: 'Giao diện tối' })).toHaveAttribute('aria-pressed', 'false');
  await screenshot(page, 'theme-light');
});

test('bấm nút để sang giao diện tối, tải lại trang vẫn giữ tối ngay từ đầu (không nháy sáng)', async ({ page }) => {
  await openPlayground(page);
  await page.getByRole('button', { name: 'Giao diện tối' }).click();
  await expectTheme(page, 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0e1420');

  // Ghi lại nền <html> ngay khi DOM có, trước khi mã ứng dụng chạy: phải tối sẵn.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { firstPaper: string }).firstPaper = getComputedStyle(document.documentElement).backgroundColor;
    });
  });
  await page.reload();
  await expect(page.locator('input[type="range"]').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { firstPaper: string }).firstPaper)).toBe(PAPER.dark);
  await expectTheme(page, 'dark');
  await screenshot(page, 'theme-dark');

  await page.getByRole('button', { name: 'Giao diện tối' }).click();
  await expectTheme(page, 'light');
});

test('khi in luôn nền trắng chữ đen, kể cả đang ở giao diện tối', async ({ page }) => {
  await openPlayground(page, 'dark');
  await expectTheme(page, 'dark');
  await page.emulateMedia({ media: 'print' });

  expect(await computed(page, 'body', 'background-color')).toBe('rgb(255, 255, 255)');
  expect(await computed(page, 'body', 'color')).toBe('rgb(0, 0, 0)');
  expect(await computed(page, 'html', 'color-scheme')).toBe('light');
});
