import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { useModeStore } from '@/ui/mode-store';
import { NetworkMap } from './NetworkMap';

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
});

describe('NetworkMap (bước 4, Studio ảnh)', () => {
  test('tổng quan: 155 tầng, 410.208 số đóng băng, chỉ tầng cuối đang học', () => {
    render(<NetworkMap numClasses={3} isTraining={false} />);
    const map = screen.getByTestId('network-map');
    expect(map).toHaveTextContent('MobileNetV2 có 155 tầng với 410.208 số đã học sẵn');
    expect(map).toHaveTextContent('Huấn luyện chỉ chỉnh 3.843 số của tầng cuối.');
    expect(within(map).getAllByRole('button', { name: /đóng băng/ })).toHaveLength(19);
  });

  test('mặc định mở tầng Dense: công thức và đếm trọng số', () => {
    render(<NetworkMap numClasses={3} isTraining={false} />);
    const detail = screen.getByTestId('network-detail');
    expect(detail).toHaveTextContent('1.280 × 3 = 3.840 trọng số + 3 độ lệch = 3.843 số.');
    expect(screen.getByTestId('network-dense')).toHaveAttribute('aria-pressed', 'true');
  });

  test('bấm một khối: các loại tầng, kích thước, số tham số, gợi ý bản đồ đặc trưng', async () => {
    render(<NetworkMap numClasses={2} isTraining={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Khối 3: đầu ra 28 × 28 × 16, đóng băng' }));
    const detail = screen.getByTestId('network-detail');
    expect(detail).toHaveTextContent('Khối 3: đầu ra 28 × 28 × 16');
    expect(detail).toHaveTextContent('DepthwiseConv2D × 1');
    expect(detail).toHaveTextContent('2.032 số đã học sẵn');
    expect(detail).toHaveTextContent('block_3_expand_relu');
    expect(detail).toHaveTextContent('không đổi khi bạn huấn luyện');
  });

  test('đang huấn luyện thì tầng Dense ghi "đang chỉnh"; Chuyên sâu hiện tên từng tầng', async () => {
    useModeStore.setState({ mode: 'expert' });
    render(<NetworkMap numClasses={2} isTraining />);
    expect(screen.getByTestId('network-dense')).toHaveTextContent('Dense (đang chỉnh…)');
    await userEvent.click(screen.getByRole('button', { name: /^Cuối: đầu ra 7 × 7 × 1280/ }));
    expect(screen.getByTestId('network-detail')).toHaveTextContent('Conv_1 → Conv_1_bn → out_relu');
  });
});
