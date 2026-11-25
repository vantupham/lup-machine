import { expect, test } from '@playwright/test';

/** Tệp WAV PCM 16 bit, một kênh: tiếng huýt đều ở `hz` trong `seconds` giây (giữa đoạn có im lặng). */
function wav(hz: number, seconds: number, rate = 44_100): Buffer {
  const n = Math.round(rate * 1.2);
  const data = Buffer.alloc(n * 2);
  const start = Math.round(rate * 0.2);
  for (let i = 0; i < n; i++) {
    const on = i >= start && i < start + seconds * rate;
    data.writeInt16LE(on ? Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 0.5 * 32767) : 0, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

test('Studio âm thanh: âm thanh mẫu, thu bằng micro (giả), tải tệp WAV và nhận ra tiếng còi', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
  await page.goto('./#/studio');
  await page.getByLabel('Tên dự án').fill('Âm thanh E2E');
  await page.getByRole('radio', { name: /Âm thanh/ }).check();
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();

  await page.getByRole('button', { name: /Dùng âm thanh mẫu/ }).click();
  await expect(page.getByTestId('clip-count-2')).toHaveText('16 đoạn');

  // micro giả của Chromium: thu 1 giây vào nhóm "Trống" → thêm đúng 1 đoạn
  await page.getByTestId('clip-count-2').locator('xpath=ancestor::li[1]').getByRole('button', { name: 'Thu 1 giây' }).click();
  await expect(page.getByTestId('clip-count-2')).toHaveText('17 đoạn', { timeout: 15_000 });

  // tải tệp WAV 44,1 kHz vào nhóm "Còi": trình duyệt giải mã và đưa về 16 kHz
  await page.getByTestId('clip-count-1').locator('xpath=ancestor::li[1]').locator('input[type=file]').setInputFiles({ name: 'huyt.wav', mimeType: 'audio/wav', buffer: wav(2000, 0.5) });
  await expect(page.getByTestId('clip-count-1')).toHaveText('17 đoạn', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Huấn luyện', exact: true }).click();
  await expect(page.getByTestId('tabular-confusion')).toBeVisible();

  // thử một tệp mới: tiếng huýt 1800 Hz phải được nhận ra là còi
  await page.getByRole('region', { name: /Sử dụng/ }).locator('input[type=file]').setInputFiles({ name: 'thu.wav', mimeType: 'audio/wav', buffer: wav(1800, 0.6) });
  await expect(page.getByTestId('audio-prediction')).toHaveText(/Còi/, { timeout: 15_000 });
  await expect(page.getByTestId('audio-contribution').locator('rect')).toHaveCount(160);

  // thử bằng micro giả: thu xong thì dạng sóng mới thay cho tiếng huýt (âm thanh giả là tiếng bíp nên không kiểm tra nhóm)
  const use = page.getByRole('region', { name: /Sử dụng/ });
  const before = await use.getByRole('img', { name: 'Dạng sóng của đoạn âm thanh' }).innerHTML();
  await use.getByRole('button', { name: 'Thu 1 giây' }).click();
  await expect(use.getByRole('button', { name: 'Đang thu…' })).toBeVisible();
  await expect(use.getByRole('button', { name: 'Thu 1 giây' })).toBeVisible({ timeout: 15_000 });
  expect(await use.getByRole('img', { name: 'Dạng sóng của đoạn âm thanh' }).innerHTML()).not.toBe(before);
  await expect(page.getByTestId('audio-prediction')).toBeVisible();

  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/audio-studio.png`, fullPage: true });
});
