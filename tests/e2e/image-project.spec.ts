import { expect, test, type Page } from '@playwright/test';

/** Ghi lại mọi lỗi console (đặc biệt vi phạm CSP) để kiểm thử thất bại nếu có. */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Tạo ảnh PNG 640×480 trong trình duyệt: nửa trái đỏ, nửa phải xanh dương. */
async function makeTwoColorPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillRect(0, 0, 320, 480);
    ctx.fillStyle = 'rgb(0,0,255)';
    ctx.fillRect(320, 0, 320, 480);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  return Buffer.from(base64, 'base64');
}

async function createProject(page: Page, name: string): Promise<void> {
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill(name);
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('tạo dự án ảnh có sẵn 2 lớp và trợ lý báo lớp rỗng', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await createProject(page, 'Dự án E2E');
  await expect(page.getByRole('article', { name: 'Lớp 1' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lớp 2' })).toBeVisible();
  await expect(page.getByText('Lớp "Lớp 1" chưa có ảnh Dạy nào.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('tải ảnh lên: cắt vuông giữa, thu về 224×224 và Kính hiển vi đọc đúng điểm ảnh', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await createProject(page, 'Soi ảnh');
  const png = await makeTwoColorPng(page);

  const panel = page.getByRole('article', { name: 'Lớp 1' });
  const chooser = page.waitForEvent('filechooser');
  await panel.getByRole('button', { name: 'Tải ảnh lên' }).click();
  await (await chooser).setFiles({ name: 'hai-mau.png', mimeType: 'image/png', buffer: png });

  // lần đầu thêm ảnh phải tải mô hình làm mờ khuôn mặt (mặc định bật)
  await expect(page.getByText(/Đã thêm 1 ảnh vào lớp "Lớp 1"/)).toBeVisible({ timeout: 30_000 });
  await panel.getByRole('button', { name: /Soi ảnh/ }).click();

  const dialog = page.getByRole('dialog', { name: /Kính hiển vi/ });
  const canvas = dialog.getByRole('img');
  await expect(canvas).toBeVisible();

  // Ảnh gốc 640×480 → cắt vuông 480×480 từ x=80 → ranh giới đỏ/xanh rơi đúng giữa (x≈112).
  await canvas.focus();
  for (let i = 0; i < 3; i++) await canvas.press('Shift+ArrowLeft'); // x = 82: vùng đỏ
  await expect(dialog.getByRole('heading', { name: 'Điểm ảnh (82, 112)' })).toBeVisible();
  expect(Number(await dialog.getByTestId('pixel-r').textContent())).toBeGreaterThan(230);
  expect(Number(await dialog.getByTestId('pixel-b').textContent())).toBeLessThan(30);

  for (let i = 0; i < 6; i++) await canvas.press('Shift+ArrowRight'); // x = 142: vùng xanh
  expect(Number(await dialog.getByTestId('pixel-r').textContent())).toBeLessThan(30);
  expect(Number(await dialog.getByTestId('pixel-b').textContent())).toBeGreaterThan(230);

  expect(errors).toEqual([]);
});

test('webcam: chụp ảnh và lưu vào lớp', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await createProject(page, 'Webcam');
  await page.getByRole('article', { name: 'Lớp 2' }).getByRole('button', { name: 'Webcam' }).click();

  const dialog = page.getByRole('dialog');
  const snap = dialog.getByRole('button', { name: 'Chụp 1 ảnh' });
  await expect(snap).toBeEnabled({ timeout: 10_000 });
  await snap.click();
  // nút khóa trong lúc xử lý khung đầu (lần đầu phải tải mô hình làm mờ khuôn mặt)
  await expect(dialog.getByText('Đã chụp 1 ảnh')).toBeVisible({ timeout: 30_000 });
  await expect(snap).toBeEnabled();
  await snap.click();
  await expect(dialog.getByText('Đã chụp 2 ảnh')).toBeVisible();
  await dialog.getByRole('button', { name: 'Xong' }).click();

  await expect(page.getByText(/Đã thêm 2 ảnh vào lớp "Lớp 2"/)).toBeVisible();
  await expect(page.getByRole('article', { name: 'Lớp 2' }).getByRole('listitem')).toHaveCount(2);
  expect(errors).toEqual([]);
});
