import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { findLesson, LESSONS } from '@/content/lessons';
import { createTestRepository, renderApp } from '../../../tests/setup/render';

const open = (route: string) => renderApp(route, createTestRepository().repository);

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

afterEach(() => vi.restoreAllMocks());

describe('Phiếu bài tập in được', () => {
  test('trang bài học có liên kết tới phiếu bài tập', async () => {
    open('/lessons/bac-si-cay-trong');
    expect(screen.getByRole('link', { name: /phiếu bài tập/i })).toHaveAttribute('href', expect.stringMatching(/\/lessons\/bac-si-cay-trong\/phieu-bai-tap$/));
  });

  test('phiếu học sinh: ô họ tên, mọi câu dự đoán có chỗ ghi, KHÔNG lộ đáp án', () => {
    const lesson = findLesson('bac-si-cay-trong')!;
    open('/lessons/bac-si-cay-trong/phieu-bai-tap');
    const sheet = screen.getByRole('article', { name: /phiếu bài tập/i });
    expect(within(sheet).getByRole('heading', { level: 1 })).toHaveTextContent('AI làm bác sĩ cây trồng');
    expect(within(sheet).getByText(/Họ và tên/)).toBeInTheDocument();
    for (const step of lesson.steps.filter((s) => s.predict)) {
      expect(within(sheet).getByText(step.predict!.question)).toBeInTheDocument();
      expect(within(sheet).queryByText(step.predict!.answer)).toBeNull();
    }
    for (const q of lesson.quiz) {
      expect(within(sheet).getByText(q.question)).toBeInTheDocument();
      expect(within(sheet).queryByText(q.explanation)).toBeNull();
    }
    expect(within(sheet).queryByText(lesson.teacherNotes[0]!)).toBeNull();
  });

  test('bài 4: bảng ghi điểm theo epoch, ma trận nhầm lẫn 3×3 đúng tên lớp, bảng ngưỡng tin cậy', () => {
    open('/lessons/bac-si-cay-trong/phieu-bai-tap');
    const matrix = screen.getByRole('table', { name: /ma trận nhầm lẫn/i });
    expect(within(matrix).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(expect.arrayContaining(['Lá khỏe', 'Bệnh đốm góc', 'Bệnh gỉ sắt']));
    expect(within(matrix).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Lá khỏe', 'Bệnh đốm góc', 'Bệnh gỉ sắt']);
    expect(within(matrix).getAllByRole('cell').every((c) => c.textContent === '')).toBe(true);
    expect(within(matrix).getAllByRole('cell')).toHaveLength(9);

    const epochs = screen.getByRole('table', { name: /phát lại/i });
    expect(within(epochs).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['0', '10', '50']);
    const thresholds = screen.getByRole('table', { name: /ngưỡng tin cậy/i });
    expect(within(thresholds).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['50%', '70%', '90%']);
    expect(screen.getByText('Cặp lớp bị nhầm nhiều nhất:')).toBeInTheDocument();
  });

  test('bản giáo viên: hiện đáp án dự đoán, đáp án đúng của câu hỏi và ghi chú có số liệu đã kiểm chứng', async () => {
    const lesson = findLesson('bac-si-cay-trong')!;
    open('/lessons/bac-si-cay-trong/phieu-bai-tap');
    await userEvent.click(screen.getByRole('button', { name: /bản giáo viên/i }));
    expect(screen.getByRole('button', { name: /bản giáo viên/i })).toHaveAttribute('aria-pressed', 'true');
    const sheet = screen.getByRole('article', { name: /đáp án/i });
    expect(within(sheet).getByText(lesson.steps.find((s) => s.predict)!.predict!.answer)).toBeInTheDocument();
    const q = lesson.quiz[0]!;
    expect(within(sheet).getByText(q.options[q.correct]!).closest('li')).toHaveAttribute('data-correct', 'true');
    expect(within(sheet).getByText(q.explanation)).toBeInTheDocument();
    expect(within(sheet).getByText(lesson.teacherNotes[0]!)).toBeInTheDocument();
  });

  test('bản giáo viên điền số liệu mẫu vào bảng và ma trận; bản học sinh để trống', async () => {
    open('/lessons/bac-si-cay-trong/phieu-bai-tap');
    expect(screen.queryByTestId('sample-data-note')).toBeNull();
    expect(screen.getByText('Cặp lớp bị nhầm nhiều nhất:')).toBeInTheDocument();
    expect(screen.queryByText(/Bệnh gỉ sắt bị đoán là Bệnh đốm góc \(3 ảnh\)/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /bản giáo viên/i }));
    expect(screen.getByTestId('sample-data-note')).toHaveTextContent(/số liệu mẫu/);
    const matrix = screen.getByRole('table', { name: /ma trận nhầm lẫn/i });
    expect(within(matrix).getAllByRole('cell').map((c) => c.textContent)).toEqual(['5', '0', '1', '0', '5', '1', '0', '3', '3']);
    const thresholds = screen.getByRole('table', { name: /ngưỡng tin cậy/i });
    expect(within(thresholds).getAllByRole('cell').map((c) => c.textContent)).toEqual(['18', '72', '13', '85', '10', '90']);
    expect(screen.getByText('Bệnh gỉ sắt bị đoán là Bệnh đốm góc (3 ảnh)')).toBeInTheDocument();
    expect(screen.getByText(/Câu hỏi mở, mỗi ảnh một khác/)).toBeInTheDocument();
  });

  test.each(LESSONS.map((l) => [l.id] as [string]))('bài %s: bản giáo viên có số liệu mẫu, bản học sinh thì không', async (id) => {
    open(`/lessons/${id}/phieu-bai-tap`);
    expect(screen.queryByTestId('sample-data-note')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /bản giáo viên/i }));
    expect(screen.getByTestId('sample-data-note')).toBeInTheDocument();
  });

  test('nút In gọi lệnh in của trình duyệt', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    open('/lessons/bac-si-cay-trong/phieu-bai-tap');
    await userEvent.click(screen.getByRole('button', { name: /in phiếu/i }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  test.each(LESSONS.map((l) => [l.id] as [string]))('bài %s có phiếu bài tập dùng được', (id) => {
    open(`/lessons/${id}/phieu-bai-tap`);
    expect(screen.getByRole('article', { name: /phiếu bài tập/i })).toBeInTheDocument();
  });

  test('bài không tồn tại', () => {
    open('/lessons/khong-co/phieu-bai-tap');
    expect(screen.getByRole('alert')).toHaveTextContent('Không tìm thấy bài học này.');
  });
});
