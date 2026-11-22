import { expect, test } from '@playwright/test';

/** Ứng dụng cài được (PWA): Chromium tự đánh giá manifest, biểu tượng và service worker. */
test('Chromium coi LUP Machine là ứng dụng cài đặt được; biểu tượng tải được và có trong bộ nhớ ngoại tuyến', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('offline-status')).toContainText('dùng được cả khi mất mạng', { timeout: 60_000 });

  // Danh sách lỗi khiến trình duyệt từ chối cài (thiếu biểu tượng phù hợp, thiếu service worker…).
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  console.warn('[pwa] lỗi cài đặt:', JSON.stringify(installabilityErrors));
  expect(installabilityErrors).toEqual([]);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(manifestHref!, page.url()).href;
  const manifest = (await (await page.request.get(manifestUrl)).json()) as { icons: { src: string; type: string }[] };
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const iconUrls = [
    ...manifest.icons.filter((i) => i.type === 'image/png').map((i) => new URL(i.src, manifestUrl).href),
    new URL(appleHref!, page.url()).href,
  ];
  for (const url of iconUrls) {
    const response = await page.request.get(url);
    expect(response.status(), url).toBe(200);
    expect(response.headers()['content-type'], url).toContain('image/png');
  }

  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await (await caches.open(keys[0]!)).keys()).map((r) => r.url);
  });
  for (const url of iconUrls) expect(cached, url).toContain(url);
});
