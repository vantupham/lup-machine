import { expect, test, type Page } from '@playwright/test';
import { lessonPixels } from '../../src/content/lessons/lesson-1-pixels';
import { lessonTraining } from '../../src/content/lessons/lesson-2-training';
import { lessonShortcut } from '../../src/content/lessons/lesson-3-shortcut';
import { lessonPlantDisease } from '../../src/content/lessons/lesson-4-plant-disease';
import type { Lesson, WorksheetRecord } from '../../src/content/lessons/types';

/** Kiểm chứng bằng MobileNetV2 thật rằng nội dung bài học nói đúng với những gì học sinh sẽ thấy. */

async function scores(page: Page): Promise<{ train: number; test: number }> {
  // Điểm hiển thị kiểu Việt Nam, ví dụ "97,6%".
  const read = async (id: string) => Number((await page.getByTestId(id).textContent())?.replace(',', '.').replace(/[^\d.]/g, ''));
  return { train: await read('score-train'), test: await read('score-test') };
}

async function extractAndTrain(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Biến ảnh thành vector \(48 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: /^(Bắt đầu huấn luyện|Huấn luyện lại)$/ }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
}

// ── Số liệu mẫu trên bản giáo viên của phiếu bài tập ──────────────────────────────
type Rec<K extends WorksheetRecord['kind']> = Extract<WorksheetRecord, { kind: K }>;
function recordOf<K extends WorksheetRecord['kind']>(lesson: Lesson, kind: K, match: (r: Rec<K>) => boolean = () => true): Rec<K> {
  const found = lesson.steps.flatMap((st) => st.record ?? []).find((r): r is Rec<K> => r.kind === kind && match(r as Rec<K>));
  if (!found) throw new Error(`${lesson.id}: thiếu khung ${kind}`);
  return found;
}
/** "60,4%" → 60.4 (số kiểu Việt Nam, bỏ ký hiệu đơn vị). */
const num = (v: string) => Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
const pctOf = async (page: Page, id: string) => num((await page.getByTestId(id).textContent())!.replace(/[^\d,.]/g, ''));
async function confusionCount(page: Page, actual: string, predicted: string): Promise<number> {
  return Number((await page.getByRole('button', { name: `ảnh lớp ${actual} bị đoán là ${predicted}`, exact: false }).getAttribute('aria-label'))!.split(' ')[0]);
}
/** Ma trận trên màn hình khớp ma trận mẫu, mỗi ô lệch tối đa 1 ảnh (card đồ họa khác nhau có thể lệch nhẹ). */
async function expectConfusionNear(page: Page, names: readonly string[], key: readonly (readonly number[])[]) {
  for (const [i, actual] of names.entries()) {
    for (const [j, predicted] of names.entries()) {
      expect(Math.abs((await confusionCount(page, actual, predicted)) - key[i]![j]!), `${actual} → ${predicted}`).toBeLessThanOrEqual(1);
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('lup.language', 'vi'));
});

test('bài 3 "AI học nhầm": mô hình học theo nền — điểm Dạy cao, điểm Kiểm tra thấp', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./#/lessons/ai-hoc-nham');
  await page.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Thử thách: AI học nhầm điều gì?' })).toBeVisible({ timeout: 30_000 });
  await extractAndTrain(page);

  const trap = await scores(page);
  console.warn(`[bẫy] Dạy ${trap.train}% / Kiểm tra ${trap.test}%`);
  expect(trap.train).toBeGreaterThanOrEqual(95);
  expect(trap.test).toBeLessThanOrEqual(50);
  expect(await page.getByTestId('wrong-ring').count()).toBeGreaterThanOrEqual(6);
  await expectConfusionNear(page, ['Hình tròn', 'Hình vuông'], recordOf(lessonShortcut, 'confusion').answers!);
  // Đáp án mẫu bước "Tìm bằng chứng": ảnh Dạy giống nhất của hình tròn bị đoán sai đều là hình vuông.
  const map = page.getByRole('group', { name: 'Bản đồ dữ liệu 2D' });
  await map.getByRole('button', { name: /ảnh lớp hình tròn, ngăn kiểm tra/i }).first().click();
  const neighbors = await page.getByTestId('selected-detail').getByText(/^(Hình tròn|Hình vuông) · /).allTextContents();
  console.warn('[bẫy] ảnh Dạy giống nhất:', neighbors.join(' | '));
  expect(neighbors).toHaveLength(3);
  expect(neighbors.every((n) => n.startsWith('Hình vuông'))).toBe(true);

  // Bước "sửa dữ liệu" trong bài: chuyển 3/6 ảnh Kiểm tra mỗi lớp sang ngăn Dạy rồi huấn luyện lại.
  for (const name of ['Hình tròn', 'Hình vuông']) {
    const panel = page.getByRole('article', { name });
    await panel.getByRole('tab', { name: /Kiểm tra/ }).click();
    for (let i = 0; i < 3; i++) {
      await panel.getByRole('listitem').first().hover();
      await panel.getByRole('button', { name: /Chuyển sang Dạy/ }).first().click();
      await expect(panel.getByRole('tab', { name: `Kiểm tra (${5 - i})` })).toBeVisible();
    }
  }
  await page.getByRole('button', { name: /^(Bắt đầu huấn luyện|Huấn luyện lại)$/ }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const fixed = await scores(page);
  console.warn(`[sau khi sửa] Dạy ${fixed.train}% / Kiểm tra ${fixed.test}%`);
  test.info().annotations.push({ type: 'scores', description: `bẫy: ${trap.train}/${trap.test} → sau khi sửa: ${fixed.train}/${fixed.test}` });
  expect(fixed.test).toBeGreaterThan(trap.test);
  const [before, after] = recordOf(lessonShortcut, 'table').answers!;
  expect(Math.abs(trap.train - num(before![0]!))).toBeLessThanOrEqual(2.1); // 1 trong 48 ảnh Dạy
  expect(Math.abs(trap.test - num(before![1]!))).toBeLessThanOrEqual(8.4); // 1 trong 12 ảnh Kiểm tra
  expect(Math.abs(fixed.train - num(after![0]!))).toBeLessThanOrEqual(2.4); // 1 trong 42 ảnh Dạy
  expect(Math.abs(fixed.test - num(after![1]!))).toBeLessThanOrEqual(16.7); // 1 trong 6 ảnh Kiểm tra

  expect(errors).toEqual([]);
});

test('bộ "Tròn, vuông, tam giác": ảnh vẽ đúng và mô hình học được hình dạng', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./#/studio');
  await page.getByRole('region', { name: /bộ dữ liệu mẫu/i }).getByRole('button', { name: 'Tạo dự án mẫu' }).nth(1).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('article', { name: 'Tam giác' }).getByRole('tab', { name: 'Dạy (18)' })).toBeVisible();

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await page.getByRole('article', { name: 'Hình tròn' }).screenshot({ path: `${shots}/samples.png` });

  await page.getByRole('button', { name: /Biến ảnh thành vector \(72 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const { test: testScore } = await scores(page);
  test.info().annotations.push({ type: 'scores', description: `kiểm tra: ${testScore}%` });
  expect(testScore).toBeGreaterThanOrEqual(60);
});

test('bài 4 "AI làm bác sĩ cây trồng": mọi khẳng định của bài đúng với MobileNet thật', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const pct = async (id: string) => Number((await page.getByTestId(id).textContent())?.replace(',', '.').replace(/[^\d.]/g, ''));

  await page.goto('./#/lessons/bac-si-cay-trong');
  await expect(page.getByRole('heading', { level: 1, name: 'AI làm bác sĩ cây trồng' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Bác sĩ lá đậu/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Biến ảnh thành vector \(90 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });

  // Bước 3: quá khớp — Dạy ~100%, Kiểm tra quanh 70–80%, có cảnh báo; học lâu hơn không giúp.
  const finalTest = await pct('score-test');
  console.warn(`[bài 4] Dạy ${await pct('score-train')}% / Kiểm tra ${finalTest}%`);
  expect(await pct('score-train')).toBeGreaterThanOrEqual(95);
  expect(finalTest).toBeGreaterThanOrEqual(60);
  expect(finalTest).toBeLessThanOrEqual(85);
  await expect(page.getByRole('alert').filter({ hasText: /quá khớp/i })).toBeVisible();
  const slider = page.getByRole('slider', { name: /phát lại/i });
  await slider.fill('10');
  const earlyTest = await pct('score-test');
  await slider.fill('50');
  expect(Math.abs(finalTest - earlyTest)).toBeLessThanOrEqual(12);

  // Bước 4: lỗi hay gặp nhất là gỉ sắt → đốm góc; lá bệnh hầu như không bị đoán là khỏe.
  const count = async (actual: string, predicted: string) =>
    Number((await page.getByRole('button', { name: `ảnh lớp ${actual} bị đoán là ${predicted}`, exact: false }).getAttribute('aria-label'))?.split(' ')[0]);
  const off = {
    rustAsSpot: await count('Bệnh gỉ sắt', 'Bệnh đốm góc'),
    spotAsRust: await count('Bệnh đốm góc', 'Bệnh gỉ sắt'),
    healthyAsSpot: await count('Lá khỏe', 'Bệnh đốm góc'),
    healthyAsRust: await count('Lá khỏe', 'Bệnh gỉ sắt'),
    spotAsHealthy: await count('Bệnh đốm góc', 'Lá khỏe'),
    rustAsHealthy: await count('Bệnh gỉ sắt', 'Lá khỏe'),
  };
  console.warn('[bài 4] nhầm lẫn', JSON.stringify(off));
  expect(off.rustAsSpot).toBe(Math.max(...Object.values(off)));
  expect(off.spotAsHealthy + off.rustAsHealthy).toBeLessThanOrEqual(1);

  // Số liệu mẫu in trên bản giáo viên phải khớp lần chạy thật (mỗi ô lệch tối đa 1 ảnh giữa các máy).
  const key = lessonPlantDisease.steps.flatMap((st) => st.record ?? []).find((r) => r.kind === 'confusion');
  const names = ['Lá khỏe', 'Bệnh đốm góc', 'Bệnh gỉ sắt'];
  if (key?.kind !== 'confusion' || !key.answers) throw new Error('bài 4 thiếu ma trận mẫu');
  for (const [i, actual] of names.entries()) {
    for (const [j, predicted] of names.entries()) {
      expect(Math.abs((await count(actual, predicted)) - key.answers[i]![j]!), `${actual} → ${predicted}`).toBeLessThanOrEqual(1);
    }
  }

  // Bước 6: ngưỡng 90% — trả lời ít hơn (khoảng một nửa) nhưng đúng nhiều hơn.
  await page.getByRole('slider', { name: /ngưỡng/i }).fill('0.9');
  const summary = (await page.getByTestId('threshold-summary').textContent())!;
  const [, answered, total, accuracy] = /Trả lời (\d+)\/(\d+) ảnh .* đúng (\d+)%/.exec(summary)!;
  console.warn(`[bài 4] ngưỡng 90%: ${summary}`);
  expect(Number(answered)).toBeLessThan(Number(total));
  expect(Number(answered)).toBeGreaterThanOrEqual(Number(total) / 3);
  expect(Number(accuracy)).toBeGreaterThan(finalTest);

  expect(errors).toEqual([]);
});

test('bài 1: số liệu mẫu (màu điểm ảnh của ảnh đầu tiên) khớp Kính hiển vi', async ({ page }) => {
  await page.goto('./#/lessons/may-tinh-nhin-anh');
  await page.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tròn hay vuông?' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('article', { name: 'Hình tròn' }).getByRole('button', { name: /soi ảnh/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('pixel-r')).toBeVisible();
  const key = recordOf(lessonPixels, 'table').answers!;
  // Kính hiển vi 336 px cho ảnh 224 px → mỗi điểm ảnh 1,5 px.
  for (const [i, [x, y]] of ([[2, 2], [98, 136]] as const).entries()) {
    await dialog.getByRole('img').first().click({ position: { x: (x + 0.5) * 1.5, y: (y + 0.5) * 1.5 } });
    await expect(dialog.getByRole('heading', { name: `Điểm ảnh (${x}, ${y})` })).toBeVisible();
    for (const [c, ch] of (['r', 'g', 'b'] as const).entries()) {
      expect(Math.abs(Number(await dialog.getByTestId(`pixel-${ch}`).textContent()) - Number(key[i]![c]!))).toBeLessThanOrEqual(3);
    }
  }
});

test('bài 2: số liệu mẫu (bản đồ, điểm theo epoch, ma trận epoch 5, thí nghiệm 3 epoch) khớp MobileNet thật', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('./#/lessons/day-may-phan-biet-hinh');
  await page.getByRole('button', { name: 'Tạo dự án mẫu cho bài này' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Biến ảnh thành vector [(]72 ảnh/ }).click();
  await expect(page.getByText('Tất cả ảnh đã có vector đặc trưng.')).toBeVisible({ timeout: 120_000 });
  const kept = num(/([\d,]+)%/.exec((await page.getByTestId('map-kept').textContent())!)![1]!);
  expect(Math.abs(kept - num(recordOf(lessonTraining, 'fields').answers![0]!))).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: 'Bắt đầu huấn luyện' }).click();
  await expect(page.getByText('Xong 50 epoch.')).toBeVisible({ timeout: 60_000 });
  const epochs = recordOf(lessonTraining, 'table', (r) => r.rows.includes('5'));
  const slider = page.getByRole('slider', { name: /phát lại/i });
  for (const [i, epoch] of epochs.rows.entries()) {
    await slider.fill(epoch);
    expect(Math.abs((await pctOf(page, 'score-train')) - num(epochs.answers![i]![0]!)), `Dạy epoch ${epoch}`).toBeLessThanOrEqual(1.9); // 1/54 ảnh
    expect(Math.abs((await pctOf(page, 'score-test')) - num(epochs.answers![i]![1]!)), `Kiểm tra epoch ${epoch}`).toBeLessThanOrEqual(5.6); // 1/18 ảnh
  }
  await slider.fill('5');
  await expectConfusionNear(page, ['Hình tròn', 'Hình vuông', 'Tam giác'], recordOf(lessonTraining, 'confusion').answers!);

  // Thí nghiệm nhỏ: 3 epoch (chế độ Chuyên sâu).
  await page.locator('label', { has: page.getByRole('radio', { name: /Chuyên sâu/ }) }).click();
  await page.getByLabel('Số epoch').fill('3');
  await page.getByRole('button', { name: /^(Bắt đầu huấn luyện|Huấn luyện lại)$/ }).click();
  await expect(page.getByText('Xong 3 epoch.')).toBeVisible({ timeout: 60_000 });
  const short = recordOf(lessonTraining, 'table', (r) => r.rows.includes('3')).answers![1]!;
  expect(Math.abs((await pctOf(page, 'score-train')) - num(short[0]!))).toBeLessThanOrEqual(1.9);
  expect(Math.abs((await pctOf(page, 'score-test')) - num(short[1]!))).toBeLessThanOrEqual(5.6);
});
