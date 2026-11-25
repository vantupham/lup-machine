import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import type { RunSetup } from '@/core/experiments/run-diff';
import { ExperimentPlan } from './ExperimentPlan';

const previous: RunSetup = {
  options: { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 42 },
  counts: { train: 36, test: 12 },
  classNames: ['Tròn', 'Vuông'],
  fingerprint: 'aaaa',
};

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

describe('Khung "đã đổi gì" trước khi huấn luyện lại', () => {
  test('chưa đổi gì: nói rõ kết quả sẽ giống hệt', () => {
    render(<ExperimentPlan previousNumber={3} previous={previous} current={previous} />);
    expect(screen.getByTestId('experiment-plan')).toHaveTextContent('Chưa đổi gì so với lần #3. Cùng seed nên kết quả sẽ giống hệt.');
  });

  test('đổi một tham số: liệt kê, không cảnh báo', () => {
    render(<ExperimentPlan previousNumber={1} previous={previous} current={{ ...previous, options: { ...previous.options, epochs: 10 } }} />);
    const plan = screen.getByTestId('experiment-plan');
    expect(plan).toHaveTextContent('So với lần #1, em đã đổi:');
    expect(plan).toHaveTextContent('số epoch 50 → 10');
    expect(plan).not.toHaveTextContent('cùng lúc');
  });

  test('đổi tham số và thêm ảnh Huấn luyện: nhắc đổi 2 thứ cùng lúc', () => {
    render(
      <ExperimentPlan
        previousNumber={1}
        previous={previous}
        current={{ ...previous, options: { ...previous.options, learningRate: 0.01 }, counts: { train: 40, test: 12 }, fingerprint: 'bbbb' }}
      />,
    );
    expect(screen.getByText(/Em đổi 2 thứ cùng lúc/)).toBeInTheDocument();
    expect(screen.queryByText(/chưa công bằng/)).toBeNull();
  });

  test('đổi tập Kiểm tra: nhắc so điểm Kiểm tra chưa công bằng', () => {
    render(<ExperimentPlan previousNumber={2} previous={previous} current={{ ...previous, counts: { train: 37, test: 11 }, fingerprint: 'cccc' }} />);
    expect(screen.getByText('Tập Kiểm tra đã đổi nên so điểm Kiểm tra với lần #2 chưa công bằng.', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('experiment-plan')).toHaveTextContent('ảnh Kiểm tra 12 → 11');
  });
});
