import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { useModeStore } from '@/ui/mode-store';
import { createTestRepository, renderWithRepositories } from '../../../tests/setup/render';

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  // Nhật ký thí nghiệm nằm ở 6 bước chi tiết: dùng Chuyên sâu (không có khối làm nhanh, các bước luôn mở).
  useModeStore.setState({ mode: 'expert' });
});

describe('Nhật ký thí nghiệm ở Studio văn bản', () => {
  test('lần đầu; đổi mô hình rồi đoán trước; so với lần trước, từng lớp, ghi kết luận', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Chủ đề', projectType: 'text' });
    renderWithRepositories(`/studio/${project.id}`, r);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Chủ đề: thời tiết/ }));
    await screen.findByTestId('text-size');

    // Lần 1
    await user.type(screen.getByLabelText('Em đoán điểm Kiểm tra (%)'), '90');
    await user.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    const first = await screen.findByTestId('trial-result');
    expect(first).toHaveTextContent('Đây là lần chạy đầu tiên.');
    expect(within(first).getByTestId('trial-guess')).toHaveTextContent(/^Em đoán 90%\. Điểm Kiểm tra thực tế: \d+%/);
    expect(screen.queryByTestId('trial-before')).toBeNull();
    expect(screen.getByTestId('studio-findings')).toHaveTextContent('trên tập Kiểm tra');

    // Đổi mô hình: khung "đã đổi gì" hiện lại
    await user.click(screen.getByRole('radio', { name: /Hồi quy logistic/ }));
    expect(await screen.findByTestId('trial-plan')).toHaveTextContent('mô hình: Naive Bayes → Hồi quy logistic');
    await user.click(screen.getByRole('button', { name: 'Huấn luyện' }));

    await screen.findByText('Kết quả so với lần #1');
    const second = screen.getByTestId('trial-result');
    expect(within(second).getByTestId('trial-delta')).toHaveTextContent(/^Điểm Kiểm tra: \d+% → \d+% \(/);
    expect(within(second).getByTestId('trial-recall')).toHaveTextContent('thời tiết');

    await user.type(within(second).getByLabelText('Kết luận của em'), 'Logistic tốt hơn');
    await user.tab();
    await waitFor(async () => expect((await r.trials.list(project.id))[0]?.conclusion).toBe('Logistic tốt hơn'));
    const log = screen.getByRole('table', { name: 'Nhật ký thí nghiệm' });
    expect(within(log).getByTestId('trial-row-1')).toHaveTextContent('Lần đầu');
    expect(within(log).getByTestId('trial-row-1')).toHaveTextContent('90%');
    expect(within(log).getByTestId('trial-row-2')).toHaveTextContent('mô hình: Naive Bayes → Hồi quy logistic');
  });

  test('đổi seed: nhắc tập Kiểm tra đã đổi', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Chủ đề', projectType: 'text' });
    renderWithRepositories(`/studio/${project.id}`, r);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Chủ đề: thời tiết/ }));
    await user.click(await screen.findByRole('button', { name: 'Huấn luyện' }));
    await screen.findByTestId('trial-result');
    await user.click(screen.getByRole('button', { name: 'Chia lại' }));
    const plan = await screen.findByTestId('trial-plan');
    expect(plan).toHaveTextContent(/seed \d+ → \d+/);
    expect(plan).toHaveTextContent('Tập Kiểm tra đã đổi nên so điểm Kiểm tra với lần #1 chưa công bằng.');
  });
});

describe('Nhật ký thí nghiệm ở Studio bảng số (hồi quy)', () => {
  test('điểm là R², không hỏi đoán phần trăm; đổi mô hình thì so R² hai lần', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Chim cánh cụt', projectType: 'tabular' });
    renderWithRepositories(`/studio/${project.id}`, r);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Chim cánh cụt/ }));
    await screen.findByTestId('tabular-issues');
    fireEvent.change(screen.getByLabelText('Cột cần dự đoán (nhãn)'), { target: { value: 'Cân nặng (g)' } });
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Hồi quy (đoán con số)' })).toBeChecked());
    expect(screen.queryByLabelText('Em đoán điểm Kiểm tra (%)')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    await screen.findByTestId('trial-result');
    await user.click(screen.getByRole('radio', { name: /k láng giềng/ }));
    await user.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    const delta = await screen.findByTestId('trial-delta');
    expect(delta).toHaveTextContent(/^R² trên tập Kiểm tra: [\d,-]+ → [\d,-]+ \(/);
    expect(screen.getByTestId('finding-largest-errors')).toHaveTextContent(/dòng bị đoán lệch nhiều nhất về "Cân nặng \(g\)":/);
    const [latest] = await r.trials.list(project.id);
    expect(latest).toMatchObject({ number: 2, metric: 'r2', settings: { kind: 'knn-regression', target: 'Cân nặng (g)' } });
  });
});
