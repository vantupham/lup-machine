import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { accuracy, biasExperimentData, scoreByRegion, trainLeafModel } from '@/core/ethics/rice-leaves';
import { floorPercent } from '@/core/percent';
import { useModeStore } from '@/ui/mode-store';
import { createTestRepository, renderApp } from '../../../tests/setup/render';

const percentOf = (testId: string) => Number(screen.getByTestId(testId).textContent?.match(/(\d+)%/)?.[1]);

describe('Phòng đạo đức AI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    act(() => useModeStore.getState().setMode('explore'));
  });

  test('có trên thanh điều hướng; đủ ba phần: thí nghiệm, dữ liệu đi đâu, tình huống thảo luận', async () => {
    const user = userEvent.setup();
    renderApp('/', createTestRepository().repository);
    await user.click(screen.getByRole('link', { name: 'Đạo đức AI' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Phòng đạo đức AI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dữ liệu của em đi đâu?' })).toBeInTheDocument();
    expect(screen.getByTestId('data-flow')).toHaveTextContent('IndexedDB');
    expect(screen.getAllByRole('article')).toHaveLength(4);
  });

  test('3 bước: dự đoán trước, tách theo vùng, thu thêm dữ liệu, cho mô hình biết vùng; số hiển thị đúng số tính', async () => {
    const user = userEvent.setup();
    renderApp('/dao-duc', createTestRepository().repository);
    const step2 = screen.getByRole('button', { name: 'Thu thêm 200 lá Miền núi rồi huấn luyện lại' });
    expect(step2).toBeDisabled();
    expect(screen.getByText('Bấm "Huấn luyện" để bắt đầu.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    const d = biasExperimentData();
    const biased = scoreByRegion(trainLeafModel(d.trainBiased), d.test);
    expect(percentOf('score-overall')).toBe(floorPercent(accuracy(biased.overall)));
    // chưa dự đoán thì chưa hiện theo vùng
    expect(screen.queryByTestId('score-mountain')).toBeNull();
    expect(screen.getByText(/Dự đoán và xem độ chính xác theo vùng/)).toBeInTheDocument();
    // biểu đồ có mô tả bằng chữ vị trí ranh giới cho trình đọc màn hình
    expect(screen.getByRole('img', { name: /Biểu đồ 220 lá/ })).toHaveAccessibleDescription(/Ranh giới \(cả hai vùng\): với lá có 4 đốm, lá vàng hơn \d+% bị đoán là bệnh\./);
    const reveal = screen.getByRole('button', { name: 'Xem độ chính xác theo từng vùng' });
    expect(reveal).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Ít hơn' }));
    await user.click(reveal);

    expect(percentOf('score-mountain')).toBe(floorPercent(accuracy(biased.byRegion.mountain)));
    expect(percentOf('score-lowland')).toBeGreaterThan(percentOf('score-mountain'));
    expect(screen.getByTestId('bias-takeaway')).toHaveTextContent('Em đoán đúng');
    expect(screen.getByTestId('bias-takeaway')).toHaveTextContent('báo động nhầm');
    expect(screen.getByTestId('boundary-lowland')).toBeInTheDocument();
    expect(screen.queryByTestId('boundary-mountain')).toBeNull();

    const mountainBefore = percentOf('score-mountain');
    const lowlandBefore = percentOf('score-lowland');
    await user.click(step2);
    expect(percentOf('score-mountain')).toBeGreaterThan(mountainBefore);
    expect(percentOf('score-lowland')).toBeLessThan(lowlandBefore);

    await user.click(screen.getByRole('button', { name: 'Thêm cột "ở Miền núi" rồi huấn luyện lại' }));
    expect(percentOf('score-lowland')).toBeGreaterThanOrEqual(90);
    expect(percentOf('score-mountain')).toBeGreaterThanOrEqual(90);
    expect(screen.getByTestId('boundary-mountain')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Biểu đồ 420 lá/ })).toHaveAccessibleDescription(/Ranh giới \(Đồng bằng\).*Ranh giới \(Miền núi\)/);
    expect(screen.getByTestId('bias-takeaway')).toHaveTextContent('phân biệt đối xử');
    expect(screen.getByTestId('bias-takeaway')).toHaveTextContent('nhiệt độ');
  });

  test('dự đoán sai thì được giải thích; chế độ Chuyên sâu có bảng lỗi và lấy mẫu lại', async () => {
    const user = userEvent.setup();
    act(() => useModeStore.getState().setMode('expert'));
    renderApp('/dao-duc', createTestRepository().repository);
    await user.click(screen.getByRole('button', { name: 'Huấn luyện' }));
    await user.click(screen.getByRole('radio', { name: 'Nhiều hơn' }));
    await user.click(screen.getByRole('button', { name: 'Xem độ chính xác theo từng vùng' }));
    expect(screen.getByTestId('bias-takeaway')).toHaveTextContent('Chưa đúng');

    const table = screen.getByTestId('error-table');
    const mountainRow = within(table).getByRole('row', { name: /Miền núi/ });
    // lỗi ở Miền núi đều là báo động nhầm, không bỏ sót
    expect(within(mountainRow).getAllByRole('cell').at(-1)).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'Lấy mẫu lại (1/10)' }));
    expect(screen.getByRole('button', { name: 'Lấy mẫu lại (2/10)' })).toBeInTheDocument();
    const d = biasExperimentData(1000);
    expect(percentOf('score-mountain')).toBe(floorPercent(accuracy(scoreByRegion(trainLeafModel(d.trainBiased), d.test).byRegion.mountain)));
  });
});
