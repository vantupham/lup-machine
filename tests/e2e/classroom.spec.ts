import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';

async function download(page: Page, button: string): Promise<{ name: string; path: string }> {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()]);
  // Lưu ra thư mục của test: tệp tải về tạm sẽ bị xóa khi đóng bối cảnh trình duyệt ("máy" của giáo viên).
  const path = test.info().outputPath(file.suggestedFilename());
  await file.saveAs(path);
  return { name: file.suggestedFilename(), path };
}

test('lớp học qua tệp: giáo viên tạo .lupa (kèm dự án mẫu), học sinh ở máy khác làm bài và nộp .lups, giáo viên chấm và xuất Excel', async ({ browser }) => {
  test.setTimeout(180_000);
  const vi = () => window.localStorage.setItem('lup.language', 'vi');

  // --- máy giáo viên: dự án mẫu ảnh + gói bài tập
  const teacherContext = await browser.newContext();
  await teacherContext.addInitScript(vi);
  const teacher = await teacherContext.newPage();
  await teacher.goto('./#/studio');
  await teacher.getByRole('region', { name: /bộ dữ liệu mẫu/i }).getByRole('button', { name: 'Tạo dự án mẫu' }).nth(1).click();
  await expect(teacher.getByRole('heading', { level: 1, name: 'Tròn, vuông, tam giác' })).toBeVisible({ timeout: 30_000 });

  await teacher.getByRole('link', { name: 'Góc giáo viên' }).click();
  await teacher.getByLabel('Tên bài').fill('Nhận dạng hình');
  await teacher.getByLabel('Giáo viên', { exact: true }).fill('Thầy Minh');
  await teacher.getByLabel('Đề bài').fill('Huấn luyện mô hình, thêm ảnh tự vẽ, ghi độ chính xác.');
  await teacher.getByRole('button', { name: '+ Thêm câu hỏi' }).click();
  await teacher.getByLabel('Câu hỏi 1', { exact: true }).fill('Hình nào hay bị nhầm nhất?');
  await teacher.getByLabel('Dự án mẫu').selectOption({ label: 'Tròn, vuông, tam giác' });
  const lupa = await download(teacher, 'Tải gói bài tập (.lupa)');
  expect(lupa.name).toBe('nhan-dang-hinh.lupa');
  await teacherContext.close();

  // --- máy học sinh (bộ nhớ trình duyệt riêng)
  const studentContext = await browser.newContext();
  await studentContext.addInitScript(vi);
  const student = await studentContext.newPage();
  await student.goto('./#/studio');
  const panel = student.getByRole('region', { name: 'Mở tệp dự án' });
  await panel.getByLabel('Chọn tệp .lup').setInputFiles(lupa.path);
  await expect(panel.getByRole('status')).toHaveText(/Đã mở bài tập "Nhận dạng hình"/);
  await panel.getByRole('link', { name: /Mở dự án →/ }).click();

  // dự án mẫu đi kèm đủ ảnh
  await expect(student.getByRole('article', { name: 'Hình tròn' }).getByRole('tab', { name: 'Dạy (18)' })).toBeVisible();
  const banner = student.getByRole('complementary', { name: 'Bài tập' });
  await expect(banner).toContainText('Thầy Minh');

  // thẻ mô hình
  await student.getByRole('link', { name: /Thẻ mô hình · chưa điền đủ/ }).click();
  await student.getByLabel(/Mô hình dùng để làm gì/).fill('Nhận dạng hình tròn, vuông, tam giác');
  await student.getByLabel(/Dữ liệu lấy từ đâu/).fill('Bộ ảnh mẫu của thầy');
  await student.getByLabel(/Mô hình làm tốt đến đâu/).fill('Chưa huấn luyện');
  await student.getByLabel(/Khi nào mô hình dễ sai/).fill('Hình vẽ nghiêng');
  await student.getByLabel(/Không nên dùng/).fill('Chấm bài vẽ của bạn');
  await student.getByRole('button', { name: 'Lưu thẻ' }).click();
  await expect(student.getByTestId('model-card-completeness')).toHaveText(/Đã trả lời đủ/);
  await student.getByRole('link', { name: 'Quay lại dự án', exact: false }).click();

  // làm bài và nộp
  await student.getByRole('link', { name: 'Làm bài và nộp bài →' }).click();
  await expect(student.getByText('Huấn luyện mô hình, thêm ảnh tự vẽ, ghi độ chính xác.')).toBeVisible();
  await student.getByLabel('1. Hình nào hay bị nhầm nhất?').fill('Vuông và tam giác');
  await student.getByRole('button', { name: 'Lưu câu trả lời' }).click();
  await student.getByLabel('Họ tên học sinh').fill('Lê Chi');
  await student.getByLabel('Lớp', { exact: true }).fill('9C');
  await expect(student.getByTestId('submit-checklist')).toContainText('Đã đủ điều kiện nộp bài.');

  const shots = process.env.SCREENSHOT_DIR;
  if (shots) await student.screenshot({ path: `${shots}/assignment.png`, fullPage: true });

  const lups = await download(student, 'Tải bài nộp (.lups)');
  expect(lups.name).toBe('nhan-dang-hinh-le-chi.lups');
  const files = unzipSync(new Uint8Array(readFileSync(lups.path)));
  const submission = JSON.parse(new TextDecoder().decode(files['submission.json']));
  expect(submission).toMatchObject({ submitter: { students: 'Lê Chi', className: '9C' }, answers: ['Vuông và tam giác'], includesData: false });
  expect(submission.summary.classes).toEqual([
    { name: 'Hình tròn', count: 24, train: 18, test: 6 },
    { name: 'Hình vuông', count: 24, train: 18, test: 6 },
    { name: 'Tam giác', count: 24, train: 18, test: 6 },
  ]);
  // không kèm dữ liệu gốc: dự án bên trong không có ảnh
  expect(Object.keys(unzipSync(files['project.lup']!)).filter((n) => n.startsWith('samples/'))).toEqual([]);
  await studentContext.close();

  // --- máy giáo viên nhận bài, chấm, xuất bảng điểm Excel
  const gradingContext = await browser.newContext();
  await gradingContext.addInitScript(vi);
  const grader = await gradingContext.newPage();
  await grader.goto('./#/giao-vien?tab=cham-bai');
  await grader.getByLabel('Chọn tệp .lups').setInputFiles(lups.path);
  await expect(grader.getByTestId('import-results')).toContainText('nhan-dang-hinh-le-chi.lups (Lê Chi): Đã nhận');
  await grader.getByRole('button', { name: 'Chấm bài Lê Chi' }).click();
  const detail = grader.getByRole('region', { name: 'Bài của Lê Chi' });
  await expect(detail).toContainText('Vuông và tam giác');
  await expect(detail).toContainText('Hình vẽ nghiêng');
  await detail.getByLabel(/Dữ liệu \(tối đa 3\)/).fill('2,5');
  await detail.getByLabel(/Huấn luyện và đánh giá \(tối đa 4\)/).fill('3');
  await detail.getByLabel(/Thẻ mô hình và phiếu thí nghiệm \(tối đa 3\)/).fill('3');
  await detail.getByLabel('Nhận xét').fill('Thẻ mô hình trung thực');
  await detail.getByRole('button', { name: 'Lưu điểm' }).click();
  await expect(detail.getByText('Đã lưu điểm.')).toBeVisible();
  await expect(grader.getByTestId('class-stats')).toContainText('Điểm trung bình: 8,5/10');

  if (shots) await grader.screenshot({ path: `${shots}/grading.png`, fullPage: true });

  const xlsx = await download(grader, 'Xuất bảng điểm Excel (.xlsx)');
  expect(xlsx.name).toBe('nhan-dang-hinh-bang-diem.xlsx');
  const sheet = new TextDecoder().decode(unzipSync(new Uint8Array(readFileSync(xlsx.path)))['xl/worksheets/sheet1.xml']);
  expect(sheet).toContain('Lê Chi');
  expect(sheet).toContain('<v>8.5</v>');
  await gradingContext.close();
});
