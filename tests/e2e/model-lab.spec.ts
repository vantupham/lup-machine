import { expect, test, type Page } from '@playwright/test';

const IMAGES_PER_CLASS = 10;

/** Sinh ảnh PNG trong trình duyệt: lớp "warm" = nền đỏ/cam có hình tròn, lớp "cool" = nền xanh có sọc. */
async function makeImages(page: Page, kind: 'warm' | 'cool', count: number): Promise<Buffer[]> {
  const list = await page.evaluate(
    ({ kind, count }) =>
      Array.from({ length: count }, (_, i) => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        const ctx = c.getContext('2d')!;
        if (kind === 'warm') {
          ctx.fillStyle = `rgb(${200 + i * 5}, ${60 + i * 8}, 30)`;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#fff3';
          ctx.beginPath();
          ctx.arc(80 + i * 15, 120, 40 + i * 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgb(20, ${80 + i * 6}, ${200 + i * 5})`;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#0004';
          for (let x = i * 3; x < 320; x += 24) ctx.fillRect(x, 0, 10, 240);
        }
        return c.toDataURL('image/png').split(',')[1]!;
      }),
    { kind, count },
  );
  return list.map((b64) => Buffer.from(b64, 'base64'));
}

async function upload(page: Page, className: string, buffers: Buffer[]) {
  const panel = page.getByRole('article', { name: className });
  const chooser = page.waitForEvent('filechooser');
  await panel.getByRole('button', { name: 'Tải ảnh lên' }).click();
  await (await chooser).setFiles(buffers.map((buffer, i) => ({ name: `${className}-${i}.png`, mimeType: 'image/png', buffer })));
  // lần đầu thêm ảnh phải tải mô hình làm mờ khuôn mặt (mặc định bật), sau đó mỗi ảnh còn phải dò khuôn mặt
  await expect(page.getByText(new RegExp(`Đã thêm ${buffers.length} ảnh vào lớp "${className}"`))).toBeVisible({ timeout: 60_000 });
}

test('quy trình đầy đủ với MobileNetV2 thật: dữ liệu → biểu diễn → huấn luyện → đánh giá', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const fallbacks: string[] = [];
  page.on('console', (m) => m.text().includes('Web Worker') && fallbacks.push(m.text()));
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));

  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Ấm và lạnh');
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();

  await upload(page, 'Lớp 1', await makeImages(page, 'warm', IMAGES_PER_CLASS));
  await upload(page, 'Lớp 2', await makeImages(page, 'cool', IMAGES_PER_CLASS));
  await page.getByRole('button', { name: /Tự chia Dạy/ }).click();
  await expect(page.getByText('Đã chia lại: 16 ảnh Dạy, 4 ảnh Kiểm tra.')).toBeVisible();

  // Đo khoảng "đứng hình" dài nhất của luồng giao diện trong lúc MobileNet làm việc.
  await page.evaluate(() => {
    const w = window as unknown as { longestTask: number };
    w.longestTask = 0;
    new PerformanceObserver((list) => list.getEntries().forEach((e) => (w.longestTask = Math.max(w.longestTask, e.duration)))).observe({ type: 'longtask', buffered: false });
  });
  await page.getByRole('button', { name: /Biến ảnh thành vector \(20 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 90_000 });
  const longestTask = await page.evaluate(() => (window as unknown as { longestTask: number }).longestTask);
  console.warn(`[worker] khoảng đứng hình dài nhất của giao diện khi trích đặc trưng: ${Math.round(longestTask)} ms`);
  // MobileNet chạy trong Web Worker, không phải luồng giao diện.
  expect(page.workers().some((w) => w.url().includes('feature-worker'))).toBe(true);
  const map = page.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
  await expect(map.getByRole('button')).toHaveCount(20);

  await map.getByRole('button').first().click();
  await expect(page.getByTestId('feature-strip').locator('rect')).toHaveCount(1280);

  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const testScore = Number((await page.getByTestId('score-test').textContent())?.replace(',', '.').replace(/[^\d.]/g, ''));
  expect(testScore).toBeGreaterThanOrEqual(75);

  // Giai đoạn 3: tải notebook Colab chứa đặc trưng thật vừa tính trong trình duyệt.
  // Đặt NOTEBOOK_DIR để lưu lại rồi chạy thật bằng scripts/check-notebooks.py.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải notebook (.ipynb)' }).click()]);
  expect(download.suggestedFilename()).toMatch(/-lup-machine\.ipynb$/);
  const { readFileSync } = await import('node:fs');
  const nb = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  const sourceText = nb.cells.map((c: { source: string[] }) => c.source.join('')).join('\n');
  expect(sourceText).toContain('CLASS_NAMES = ["Lớp 1", "Lớp 2"]');
  expect(sourceText).toContain('TFLiteConverter');
  if (process.env.NOTEBOOK_DIR) await download.saveAs(`${process.env.NOTEBOOK_DIR}/e2e-image-real-features.ipynb`);

  // Giai đoạn 2a: giải thích dự đoán với kích hoạt 7×7 thật, ranh giới 2D, ngưỡng tin cậy.
  await map.getByRole('button').first().click();
  const heatmap = page.getByTestId('cam-heatmap');
  await expect(heatmap).toBeVisible({ timeout: 30_000 });
  await expect(heatmap.locator('rect')).toHaveCount(49);
  const cellValues = await heatmap.locator('rect').evaluateAll((rects) => rects.map((r) => Number(r.getAttribute('data-value'))));
  expect(new Set(cellValues.map((v) => v.toFixed(4))).size).toBeGreaterThan(1); // bản đồ thật không đồng đều
  await page.getByRole('checkbox', { name: /Hiện ranh giới quyết định/ }).check();
  await expect(page.getByTestId('decision-grid').locator('rect')).toHaveCount(48 * 48);
  await expect(page.getByTestId('threshold-summary')).toContainText('Trả lời');

  // Giai đoạn 2b ①: che thử từng ô — 50 lượt chạy MobileNet thật.
  const occlusion = page.getByTestId('occlusion');
  await occlusion.getByRole('button', { name: /che từng ô \(49 lần\)/i }).click();
  const occlusionMap = page.getByTestId('occlusion-map');
  await expect(occlusionMap.locator('rect')).toHaveCount(49, { timeout: 90_000 });
  const drops = await occlusionMap.locator('rect').evaluateAll((rects) => rects.map((r) => Number(r.getAttribute('data-value'))));
  expect(new Set(drops.map((v) => v.toFixed(5))).size).toBeGreaterThan(1);
  await expect(page.getByTestId('occlusion-summary')).toBeVisible();

  // ②: UMAP (xấp xỉ) rồi quay lại PCA.
  await page.getByRole('button', { name: 'UMAP', exact: true }).click();
  await expect(page.getByTestId('umap-note')).toContainText('seed 42', { timeout: 30_000 });
  await expect(map.getByRole('button')).toHaveCount(20);
  await page.getByRole('button', { name: 'PCA', exact: true }).click();
  await expect(page.getByTestId('map-kept')).toBeVisible();

  // ③: Chuyên sâu — bên trong mạng CNN, canvas được vẽ thật bằng kích hoạt của tầng.
  // Ô radio được ẩn (sr-only) sau nhãn → bấm vào nhãn như người dùng thật.
  await page.locator('label', { has: page.getByRole('radio', { name: /Chuyên sâu/ }) }).click();
  await expect(page.getByRole('radio', { name: /Chuyên sâu/ })).toBeChecked();
  const viewer = page.getByTestId('feature-maps');
  await viewer.getByRole('button', { name: 'Mở các tầng của mạng' }).click();
  await expect(page.getByTestId('fmap-shape')).toContainText(/Conv1_relu: 112 × 112 ô × \d+ kênh/, { timeout: 30_000 });
  await expect(page.getByTestId('fmap-channel')).toHaveCount(8);
  const distinctGray = await viewer.locator('canvas').first().evaluate((c: HTMLCanvasElement) => {
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    return new Set(Array.from({ length: data.length / 4 }, (_, i) => data[i * 4])).size;
  });
  expect(distinctGray).toBeGreaterThan(2);
  await viewer.getByRole('button', { name: 'Tầng 5' }).click();
  await expect(page.getByTestId('fmap-shape')).toContainText('out_relu: 7 × 7 ô × 1280 kênh');

  // ⑥ Sử dụng: thử ảnh MỚI (không có trong dữ liệu) bằng MobileNet thật; ảnh thử không được lưu.
  const use = page.getByRole('region', { name: /⑥ Sử dụng/ });
  const [freshWarm] = await makeImages(page, 'warm', IMAGES_PER_CLASS + 1).then((list) => list.slice(-1));
  await use.getByLabel('Tải một ảnh lên để thử').setInputFiles({ name: 'moi.png', mimeType: 'image/png', buffer: freshWarm! });
  await expect(use.getByTestId('probe-verdict')).toContainText('Lớp 1', { timeout: 30_000 });
  await expect(use.getByTestId('probe-marker')).toBeVisible();
  await expect(use.getByTestId('cam-heatmap').locator('rect')).toHaveCount(49, { timeout: 30_000 });
  await expect(map.getByRole('button')).toHaveCount(20); // ảnh thử không được thêm vào dự án
  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await use.screenshot({ path: `${shots}/use-upload.png` });
  // Webcam giả của Chromium: nhận dạng liên tục, dừng hình thì có giải thích, tắt camera thì dừng hẳn.
  await use.getByRole('button', { name: /Bật camera/ }).click();
  await expect(use.getByTestId('probe-verdict')).toContainText(/Lớp [12]/, { timeout: 30_000 });
  await use.getByRole('button', { name: /Dừng hình/ }).click();
  await expect(use.getByTestId('cam-heatmap').locator('rect')).toHaveCount(49, { timeout: 30_000 });
  if (shots) await use.screenshot({ path: `${shots}/use-webcam.png` });
  await use.getByRole('button', { name: 'Tắt camera' }).click();
  await expect(use.locator('video')).toHaveCount(0);

  if (shots) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('region', { name: '③ Biểu diễn' }).screenshot({ path: `${shots}/represent.png` });
    await page.getByTestId('selected-detail').screenshot({ path: `${shots}/explainer.png` });
    await page.getByTestId('feature-maps').screenshot({ path: `${shots}/feature-maps.png` });
    await page.getByTestId('explainer').screenshot({ path: `${shots}/occlusion.png` });
    await page.getByRole('region', { name: 'Ngưỡng tin cậy' }).screenshot({ path: `${shots}/threshold.png` });
    await page.getByRole('region', { name: '④ Huấn luyện' }).screenshot({ path: `${shots}/train.png` });
    await page.getByRole('region', { name: '⑤ Đánh giá' }).screenshot({ path: `${shots}/evaluate.png` });
  }

  expect(errors).toEqual([]);
  expect(fallbacks).toEqual([]); // không phải lùi về luồng chính
});
