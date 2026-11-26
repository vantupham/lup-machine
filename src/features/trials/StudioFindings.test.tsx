import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { StudioFindings, type FindingSample } from './StudioFindings';
import { largestErrors, RegressionFindings } from './RegressionFindings';

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

const sample = (id: string, actual: number, predicted: number, confidence = 0.6): FindingSample => ({ id, actual, predicted, confidence, evidence: <q>{id}</q> });

describe('Điểm đáng chú ý ở Studio âm thanh, tư thế, văn bản, bảng số', () => {
  test('cặp nhóm hay nhầm: bằng chứng thu gọn sẵn, mở ra xem được; nút thêm mẫu cuộn về bước Dữ liệu', async () => {
    const heading = document.createElement('h2');
    heading.id = 'text-step-data';
    heading.scrollIntoView = vi.fn();
    document.body.appendChild(heading);
    const samples = [
      ...Array.from({ length: 8 }, (_, i) => sample(`khen-${i}`, 0, 0)),
      sample('mia-mai-1', 0, 1, 0.95),
      sample('mia-mai-2', 0, 1),
      ...Array.from({ length: 10 }, (_, i) => sample(`che-${i}`, 1, 1)),
    ];
    render(<StudioFindings classNames={['khen', 'chê']} samples={samples} dataStepId="text-step-data" />);
    const top = screen.getByTestId('finding-top-confusion');
    expect(top).toHaveTextContent('Hay nhầm nhất: 2/10 mẫu khen bị đoán là chê.');
    expect(top).toHaveTextContent('Vì sao? Mẫu khen và mẫu chê giống nhau ở điểm nào?');

    const user = userEvent.setup();
    await user.click(within(top).getByRole('button', { name: 'Xem 2 mẫu này' }));
    expect(within(top).getByTestId('finding-evidence')).toHaveTextContent('mia-mai-1');
    await user.click(within(top).getByRole('button', { name: 'Thêm mẫu cho nhóm khen ở bước Dữ liệu' }));
    expect(heading.scrollIntoView).toHaveBeenCalled();

    const confident = screen.getByTestId('finding-confident-mistakes');
    expect(confident).toHaveTextContent('1 mẫu sai mà máy vẫn tin từ 80% trở lên.');
    expect(within(confident).getByTestId('finding-evidence')).toHaveTextContent('mia-mai-1khen → chê (95%)');
    heading.remove();
  });

  test('số thập phân theo ngôn ngữ đang chọn (6,3 điểm)', () => {
    const samples = Array.from({ length: 16 }, (_, i) => sample(`s${i}`, i % 2, i % 2));
    render(<StudioFindings classNames={['khen', 'chê']} samples={samples} dataStepId="x" />);
    expect(screen.getByTestId('finding-small-set')).toHaveTextContent('Chỉ có 16 mẫu Kiểm tra nên mỗi mẫu làm điểm đổi 6,3 điểm.');
  });

  test('hồi quy: 3 dòng lệch nhiều nhất, lệch lớn trước; tập nhỏ thì nhắc', () => {
    const rows = [
      { rowNumber: 2, actual: 4000, predicted: 4100 },
      { rowNumber: 5, actual: 3500, predicted: 4500 },
      { rowNumber: 9, actual: 5000, predicted: 4700 },
      { rowNumber: 11, actual: 3800, predicted: 3790 },
    ];
    expect(largestErrors(rows).map((r) => r.rowNumber)).toEqual([5, 9, 2]);
    render(<RegressionFindings target="Cân nặng (g)" rows={rows} />);
    const worst = screen.getByTestId('finding-largest-errors');
    expect(worst).toHaveTextContent('3 dòng bị đoán lệch nhiều nhất về "Cân nặng (g)":');
    expect(worst).toHaveTextContent('dòng 5: thật 3.500, máy đoán 4.500 (lệch 1.000)');
    expect(screen.getByTestId('finding-small-set')).toHaveTextContent('Chỉ có 4 mẫu Kiểm tra nên mỗi mẫu làm điểm đổi 25 điểm.');
  });
});
