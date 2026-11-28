import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, FilePathSource, Input } from 'mediabunny';

/** Video bài giảng: dựng từ dữ liệu thật của dự án lá đậu sau khi huấn luyện bằng MobileNetV2 thật. */

async function createAndTrain(page: Page): Promise<void> {
  await page.goto('./#/studio');
  const photos = page.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' });
  await photos.getByRole('listitem').filter({ hasText: 'Bác sĩ lá đậu' }).getByRole('button', { name: 'Tạo dự án mẫu' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Bác sĩ lá đậu/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Biến ảnh thành vector \(90 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
}

/** Canvas không trống: có nhiều hơn một màu điểm ảnh. */
async function canvasColors(page: Page): Promise<number> {
  return page.locator('canvas[data-aspect]').evaluate((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4 * 97) colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    return colors.size;
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('lup.language', 'vi');
    window.localStorage.setItem('lup.stepDetails', 'open');
  });
});

test('nút Video bài giảng chỉ bật sau khi huấn luyện; xem trước 16:9 và 9:16, tải phụ đề', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./#/studio');
  await page.getByRole('list', { name: 'Ảnh thật (giấy phép mở)' }).getByRole('listitem').filter({ hasText: 'Bác sĩ lá đậu' }).getByRole('button', { name: 'Tạo dự án mẫu' }).click();
  await expect(page.getByRole('button', { name: 'Video bài giảng' })).toBeDisabled({ timeout: 30_000 });
  await createAndTrain(page);

  await page.getByRole('button', { name: 'Video bài giảng' }).click();
  const dialog = page.getByRole('dialog', { name: 'Video bài giảng' });
  await expect(dialog).toBeVisible();
  const canvas = dialog.locator('canvas[data-aspect="16:9"]');
  await expect(canvas).toHaveAttribute('width', '1280');
  await expect(canvas).toHaveAttribute('height', '720');
  // Ảnh thu nhỏ luôn được làm mờ mặt trước khi vào video (BlazeFace thật).
  await expect(canvas).toHaveAttribute('data-thumbs', 'ready', { timeout: 60_000 });

  // Lời giảng lấy số thật của dự án: 90 ảnh, 3 lớp; có cảnh Đánh giá vì mô hình đang mở.
  await expect(dialog.getByRole('region', { name: 'Lời giảng và giọng đọc' })).toBeVisible();
  await expect(dialog.getByText(/Dự án có 90 ảnh/)).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Đánh giá' })).toBeVisible();
  await expect(dialog.getByText(/Trên \d+ ảnh kiểm tra, máy đoán đúng \d+ ảnh\./)).toBeVisible();
  // Soi kỹ chạy xong thì có cảnh "Soi kỹ dữ liệu".
  await expect(dialog.getByRole('heading', { name: 'Soi kỹ dữ liệu' })).toBeVisible({ timeout: 60_000 });

  // Kéo tới giữa video: canvas có hình.
  await dialog.getByRole('slider', { name: 'Vị trí trong video' }).fill('30');
  expect(await canvasColors(page)).toBeGreaterThan(3);

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Tải phụ đề .srt' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-bai-giang-16x9\.srt$/);
  const srt = await (await download.createReadStream()).toArray();
  const text = Buffer.concat(srt).toString('utf8');
  expect(text.startsWith('1\n00:00:00,000 --> ')).toBe(true);
  expect(text).toContain('90 ảnh');

  const shots = process.env.SCREENSHOT_DIR;
  const shoot = async (name: string, seconds: number) => {
    if (!shots) return;
    await dialog.getByRole('slider', { name: 'Vị trí trong video' }).fill(String(seconds));
    await page.locator('canvas[data-aspect]').screenshot({ path: `${shots}/${name}.png` });
  };
  for (const s of [2, 12, 30, 45, 60, 75, 90, 120]) await shoot(`lecture-16x9-${s}`, s);

  await dialog.getByRole('radio', { name: '9:16 (điện thoại)' }).check();
  await expect(dialog.locator('canvas[data-aspect="9:16"]')).toHaveAttribute('height', '1280');
  expect(await canvasColors(page)).toBeGreaterThan(3);
  for (const s of [2, 12, 30, 60, 90, 120]) await shoot(`lecture-9x16-${s}`, s);

  // Xuất video thật (WebCodecs H.264 trong Chromium) rồi đọc lại tệp MP4 bằng mediabunny.
  await dialog.getByRole('radio', { name: '16:9 (máy chiếu)' }).check();
  const exportDownload = page.waitForEvent('download', { timeout: 180_000 });
  await dialog.getByRole('button', { name: 'Xuất video' }).click();
  const video = await exportDownload;
  expect(video.suggestedFilename()).toMatch(/-bai-giang-16x9\.mp4$/);
  await expect(dialog.getByText(/Đã tạo .*\.mp4 \([\d,]+ MB\)\./)).toBeVisible();
  const input = new Input({ source: new FilePathSource(await video.path()), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  expect(track?.codec).toBe('avc');
  expect(track?.displayWidth).toBe(1280);
  expect(track?.displayHeight).toBe(720);
  const seconds = await input.computeDuration();
  const shown = await dialog.getByText(/^\d+:\d{2} \/ \d+:\d{2}$/).textContent();
  const [m, s] = (shown ?? '').split(' / ')[1]!.split(':').map(Number);
  // Thời lượng tệp khớp thời lượng xem trước (đồng hồ làm tròn xuống giây, khung cuối dài 1/30 giây).
  expect(seconds).toBeGreaterThanOrEqual(m! * 60 + s!);
  expect(seconds).toBeLessThan(m! * 60 + s! + 1.05);
  console.warn(`[video] ${video.suggestedFilename()}: ${seconds.toFixed(2)} s`);
  expect(await input.getPrimaryAudioTrack()).toBeNull();
  input.dispose();

  // Thu giọng cảnh Giới thiệu bằng micro giả của Chromium (tiếng bíp), khoảng 2,5 giây.
  await page.context().grantPermissions(['camera', 'microphone']);
  await dialog.getByRole('button', { name: 'Thu giọng cảnh Giới thiệu' }).click();
  await page.waitForTimeout(2_500);
  await dialog.getByRole('button', { name: /^Dừng \(\d+ giây\)$/ }).click();
  const recorded = dialog.getByText(/^Đã thu \d+(,\d)? giây$/);
  await expect(recorded).toBeVisible({ timeout: 20_000 });
  const voiceSeconds = Number((await recorded.textContent())!.replace(/[^\d,]/g, '').replace(',', '.'));
  expect(voiceSeconds).toBeGreaterThan(1.5);
  await expect(dialog.getByText(/^Đã thu 1\/\d+ cảnh\./)).toBeVisible();
  await expect(dialog.getByText(/Video có giọng đã thu ở 1\/\d+ cảnh\./)).toBeVisible();

  // Xuất lại: tệp có dải âm thanh (AAC, hoặc Opus khi trình duyệt không có AAC).
  const voicedDownload = page.waitForEvent('download', { timeout: 180_000 });
  await expect(dialog.getByRole('button', { name: 'Xuất video' })).toBeEnabled({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Xuất video' }).click();
  const voiced = new Input({ source: new FilePathSource(await (await voicedDownload).path()), formats: ALL_FORMATS });
  const audioTrack = await voiced.getPrimaryAudioTrack();
  // Chrome/Edge có bộ mã hóa AAC; Chromium bản Linux (CI) thì không, ứng dụng tự dùng Opus trong MP4.
  expect(['aac', 'opus']).toContain(audioTrack?.codec);
  console.warn(`[video có giọng] ${(await voiced.computeDuration()).toFixed(2)} s, âm thanh ${audioTrack?.codec}, giọng cảnh 1: ${voiceSeconds} s`);
  voiced.dispose();

  // Đóng rồi mở lại: bản thu vẫn còn (lưu trên máy).
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Video bài giảng' }).click();
  await expect(dialog.getByText(/^Đã thu 1\/\d+ cảnh\./)).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Đóng' }).click();
  expect(errors).toEqual([]);
});
