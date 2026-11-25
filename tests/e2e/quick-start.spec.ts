import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('trang chủ: một cú bấm, không gõ phím là vào không gian làm việc dự án ảnh', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: 'Tạo dự án Ảnh mới' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Dự án ảnh 1' })).toBeVisible();
  const quick = page.getByRole('region', { name: 'Dạy máy trong 3 bước' });
  await expect(quick.getByRole('group', { name: 'Lớp 1' })).toBeVisible();
  await expect(quick.getByRole('group', { name: 'Lớp 2' })).toBeVisible();
  // Khám phá: 6 bước chi tiết thu gọn sẵn, bấm một bước trên thanh thì mở và tới đúng bước đó.
  await expect(page.getByRole('heading', { name: 'Dữ liệu', exact: true })).toBeHidden();
  await page.getByRole('navigation', { name: 'Các bước của dự án' }).getByRole('button', { name: /^Bước 1:/ }).click();
  await expect(page.getByRole('article', { name: 'Lớp 1' })).toBeVisible();

  await page.getByRole('link', { name: /^LUP·Machine/ }).click();
  const recent = page.getByRole('region', { name: 'Tiếp tục dự án gần đây' });
  await expect(recent.getByRole('link', { name: 'Mở Dự án ảnh 1' })).toBeVisible();
});

test('đường dẫn #/studio/moi/am-thanh tạo đúng một dự án, Quay lại không tạo thêm', async ({ page }) => {
  await page.goto('./#/');
  await page.goto('./#/studio/moi/am-thanh');
  await expect(page.getByRole('heading', { level: 1, name: 'Dự án âm thanh 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dùng âm thanh mẫu/ })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('region', { name: 'Em muốn dạy máy nhận ra gì?' })).toBeVisible();
  await page.goto('./#/studio');
  await expect(page.getByRole('list', { name: 'Dự án của em' }).getByRole('listitem')).toHaveCount(1);
});

test('điện thoại: thẻ loại dự án hiện đủ, không cuộn ngang trang', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./#/');
  for (const type of ['Ảnh', 'Âm thanh', 'Tư thế', 'Văn bản', 'Bảng số']) {
    await expect(page.getByRole('button', { name: `Tạo dự án ${type} mới` })).toBeAttached();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('trang dự án: đổi tên tại chỗ, thanh 6 bước dính khi cuộn và đánh dấu bước đã xong', async ({ page }) => {
  await page.goto('./#/studio/moi/van-ban');
  await expect(page.getByRole('heading', { level: 1, name: 'Dự án văn bản 1' })).toBeVisible();

  await page.getByRole('button', { name: 'Đổi tên dự án' }).click();
  await page.getByRole('textbox', { name: 'Tên dự án mới' }).fill('Góp ý căng tin lớp 7A');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Góp ý căng tin lớp 7A' })).toBeVisible();

  const bar = page.getByRole('navigation', { name: 'Các bước của dự án' });
  await expect(bar.getByRole('button', { name: 'Bước 4: Huấn luyện (chưa mở)' })).toBeVisible();
  await page.getByRole('button', { name: /Góp ý căng tin/ }).click();
  await expect(bar.getByRole('button', { name: 'Bước 1: Dữ liệu (đã xong)' })).toBeVisible();

  await bar.getByRole('button', { name: 'Bước 4: Huấn luyện' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Huấn luyện/ })).toBeFocused();
  // Cuộn mượt cần một lúc: chờ thanh dính sát mép trên màn hình.
  await expect.poll(async () => (await bar.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => (await bar.boundingBox())?.y ?? 99).toBeLessThan(2);

  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Bước 4: Huấn luyện (đã xong)' })).toBeVisible();

  await page.goto('./#/studio');
  const card = page.getByRole('listitem', { name: 'Góp ý căng tin lớp 7A' });
  await expect(card).toContainText('Đã có bảng dữ liệu');
});

/** Ảnh "ấm" (nền cam) và "lạnh" (nền xanh, sọc), vẽ bằng canvas để không phụ thuộc tệp ngoài. */
async function toneImages(page: Page, kind: 'warm' | 'cool', count: number, offset = 0) {
  const list = await page.evaluate(
    ({ kind, count, offset }) =>
      Array.from({ length: count }, (_, k) => {
        const i = k + offset;
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        const ctx = c.getContext('2d')!;
        if (kind === 'warm') {
          ctx.fillStyle = `rgb(${200 + (i % 10) * 5}, ${60 + (i % 10) * 8}, 30)`;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#fff3';
          ctx.beginPath();
          ctx.arc(80 + (i % 10) * 15, 120, 40, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgb(20, ${80 + (i % 10) * 6}, ${200 + (i % 10) * 5})`;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#0004';
          for (let x = (i % 10) * 3; x < 320; x += 24) ctx.fillRect(x, 0, 10, 240);
        }
        return c.toDataURL('image/png').split(',')[1]!;
      }),
    { kind, count, offset },
  );
  return list.map((b64, i) => ({ name: `${kind}-${offset + i}.png`, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }));
}

test('khối "Dạy máy trong 3 bước": tải ảnh, Huấn luyện nhanh với MobileNet thật, thử ảnh mới', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('./#/studio/moi/anh');
  const quick = page.getByRole('region', { name: 'Dạy máy trong 3 bước' });
  await expect(quick).toBeVisible();
  // Ảnh tô màu, không có mặt người: tắt làm mờ cho nhanh. Ô này ở bước Dữ liệu, đang thu gọn trong chế độ Khám phá.
  await page.getByRole('button', { name: 'Xem từng bước bên trong' }).click();
  await page.getByRole('checkbox', { name: 'Làm mờ khuôn mặt trước khi lưu ảnh' }).uncheck();
  await page.getByRole('button', { name: 'Thu gọn các bước' }).click();
  await expect(page.getByRole('checkbox', { name: 'Làm mờ khuôn mặt trước khi lưu ảnh' })).toBeHidden();

  await quick.getByLabel('Tải ảnh cho lớp Lớp 1').setInputFiles(await toneImages(page, 'warm', 8));
  await expect(quick.getByRole('group', { name: 'Lớp 1' })).toContainText('8 ảnh');
  await quick.getByLabel('Tải ảnh cho lớp Lớp 2').setInputFiles(await toneImages(page, 'cool', 8));
  await expect(quick.getByRole('group', { name: 'Lớp 2' })).toContainText('8 ảnh');

  await quick.getByRole('button', { name: 'Huấn luyện nhanh' }).click();
  await expect(quick.getByText(/Xong\. Máy đoán đúng \d+% ảnh dạy\./)).toBeVisible({ timeout: 120_000 });
  const bar = page.getByRole('navigation', { name: 'Các bước của dự án' });
  await expect(bar.getByRole('button', { name: 'Bước 4: Huấn luyện (đã xong)' })).toBeVisible();

  const [probe] = await toneImages(page, 'warm', 1, 50);
  await quick.getByLabel('Thử với một tệp ảnh').setInputFiles(probe!);
  const rows = quick.getByRole('list', { name: 'Máy đoán' }).getByRole('listitem');
  await expect(rows).toHaveCount(2, { timeout: 30_000 });
  await expect(rows.first()).toContainText('Lớp 1');
});

