import { render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import type { RunSummary } from '@/features/studio/image/lab/run-setup';
import { InquiryRecord } from './InquiryRecord';

const metric = (test: number | null) => [{ epoch: 1, trainLoss: 0.1, trainAccuracy: 1, testLoss: 0.2, testAccuracy: test }];
const runs: RunSummary[] = [
  { number: 1, options: { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 42 }, counts: { train: 36, test: 12 }, classNames: ['A', 'B'], fingerprint: 'f1', metrics: metric(0.75), guess: { testAccuracy: 0.9 } },
  {
    number: 2,
    options: { epochs: 10, learningRate: 0.001, batchSize: 16, seed: 42 },
    counts: { train: 36, test: 12 },
    classNames: ['A', 'B'],
    fingerprint: 'f1',
    metrics: metric(0.8),
    conclusion: 'Ít epoch hơn mà điểm vẫn tăng',
  },
];
const notes = [
  { step: 'represent', text: 'Hai lớp tách rõ' },
  { step: 'data', text: 'Mỗi lớp 24 ảnh' },
];

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

describe('Sổ tay và thí nghiệm của một dự án', () => {
  test('xem trên màn hình: tóm tắt, ghi chép theo thứ tự bước, bảng các lần chạy', () => {
    render(<InquiryRecord projectType="image" notes={notes} runs={[...runs].reverse()} />);
    expect(screen.getByTestId('inquiry-summary')).toHaveTextContent('2/6 bước có ghi chép · 2 lần chạy · 1 lần đoán trước · 1 lần có kết luận');

    const written = screen.getAllByTestId(/^inquiry-note-/).map((n) => n.getAttribute('data-testid'));
    expect(written).toEqual(['inquiry-note-data', 'inquiry-note-represent']);
    expect(screen.getByTestId('inquiry-note-represent')).toHaveTextContent('Biểu diễn');
    expect(screen.getByTestId('inquiry-note-represent')).toHaveTextContent('Hai lớp tách rõ');

    const rows = within(screen.getByRole('table', { name: 'Các lần huấn luyện' })).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['#1Lần đầu90%75%', '#2số epoch 50 → 10–80%Ít epoch hơn mà điểm vẫn tăng']);
  });

  test('bản in: đủ 6 bước kèm câu hỏi (bước chưa ghi để dòng trống) và vài dòng trống trong bảng thí nghiệm', () => {
    render(<InquiryRecord projectType="image" notes={notes} runs={runs} isPrint />);
    for (const step of ['data', 'check', 'represent', 'train', 'evaluate', 'use']) {
      expect(screen.getByTestId(`inquiry-note-${step}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('inquiry-note-evaluate')).toHaveTextContent('Ô nào ngoài đường chéo có số lớn nhất?');
    const rows = within(screen.getByRole('table', { name: 'Các lần huấn luyện' })).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2 + 4);
  });

  test('chưa có gì: nói rõ chưa ghi chép, chưa huấn luyện', () => {
    render(<InquiryRecord projectType="image" notes={[]} runs={[]} />);
    expect(screen.getByText('Chưa có ghi chép nào.')).toBeInTheDocument();
    expect(screen.getByText('Chưa huấn luyện lần nào.')).toBeInTheDocument();
  });

  test('Studio văn bản: bảng các lần chạy lấy từ nhật ký thí nghiệm chung', () => {
    const base = {
      split: { testRatio: 0.2, seed: 1 },
      data: { fingerprint: 'f1', train: 40, test: 10, classNames: ['khen', 'chê'] },
      metric: 'accuracy' as const,
      createdAt: '2026-11-26T08:00:00.000Z',
    };
    const trials = [
      { ...base, number: 1, settings: { kind: 'naive-bayes', alpha: 1 }, scores: { train: 1, test: 0.8 }, guess: 0.7 },
      { ...base, number: 2, settings: { kind: 'logistic', alpha: 1 }, scores: { train: 1, test: 0.9 }, conclusion: 'Logistic tốt hơn' },
    ];
    render(<InquiryRecord projectType="text" notes={[]} runs={[]} trials={trials} />);
    expect(screen.getByTestId('inquiry-summary')).toHaveTextContent('0/6 bước có ghi chép · 2 lần chạy · 1 lần đoán trước · 1 lần có kết luận');
    const rows = within(screen.getByRole('table', { name: 'Các lần huấn luyện' })).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['#1Lần đầu70%80%', '#2mô hình: Naive Bayes → Hồi quy logistic–90%Logistic tốt hơn']);
  });
});
