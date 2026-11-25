import { expect, test, type Page } from '@playwright/test';

/** Màu (rgb) phải khớp bảng màu thô trong src/index.css. */
const PAPER = { light: 'rgb(247, 245, 239)', dark: 'rgb(14, 20, 32)' } as const;
const INK = { light: 'rgb(27, 36, 51)', dark: 'rgb(230, 226, 214)' } as const;

async function screenshot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function openPlayground(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/playground/k-means');
  await expect(page.locator('input[type="range"]').first()).toBeVisible();
}

function computed(page: Page, selector: string, prop: string): Promise<string> {
  return page.locator(selector).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`giao diện ${scheme === 'dark' ? 'tối' : 'sáng'} theo cài đặt hệ điều hành, kể cả điều khiển gốc`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPlayground(page);

    expect(await computed(page, 'body', 'background-color')).toBe(PAPER[scheme]);
    expect(await computed(page, 'body', 'color')).toBe(INK[scheme]);
    // color-scheme ở gốc → trình duyệt vẽ thanh cuộn, ô chọn, thanh trượt theo đúng chế độ.
    expect(await computed(page, 'html', 'color-scheme')).toBe('light dark');
    expect(await computed(page, 'input[type="range"]', 'color-scheme')).toBe('light dark');
    await screenshot(page, `theme-${scheme}`);
  });
}

test('khi in luôn nền trắng chữ đen, kể cả máy đang ở chế độ tối', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPlayground(page);
  await page.emulateMedia({ colorScheme: 'dark', media: 'print' });

  expect(await computed(page, 'body', 'background-color')).toBe('rgb(255, 255, 255)');
  expect(await computed(page, 'body', 'color')).toBe('rgb(0, 0, 0)');
  expect(await computed(page, 'html', 'color-scheme')).toBe('light');
});
