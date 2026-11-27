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
    render(<NetworkMap classNames={['Mèo', 'Chó', 'Gà']} isTraining={false} />);
    const map = screen.getByTestId('network-map');
    expect(map).toHaveTextContent('MobileNetV2 có 155 tầng với 410.208 số đã học sẵn');
    expect(map).toHaveTextContent('Huấn luyện chỉ chỉnh 3.843 số của tầng cuối.');
    expect(within(map).getAllByRole('button', { name: /đóng băng/ })).toHaveLength(19);
  });

  test('mặc định mở tầng Dense: công thức và đếm trọng số', () => {
    render(<NetworkMap classNames={['Mèo', 'Chó', 'Gà']} isTraining={false} />);
    const detail = screen.getByTestId('network-detail');
    expect(detail).toHaveTextContent('1.280 × 3 = 3.840 trọng số + 3 độ lệch = 3.843 số.');
    expect(screen.getByTestId('network-dense')).toHaveAttribute('aria-pressed', 'true');
  });

  test('bấm một khối: các loại tầng, kích thước, số tham số, gợi ý bản đồ đặc trưng', async () => {
    render(<NetworkMap classNames={['Mèo', 'Chó']} isTraining={false} />);
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
    render(<NetworkMap classNames={['Mèo', 'Chó']} isTraining />);
    expect(screen.getByTestId('network-dense')).toHaveTextContent('Dense (đang chỉnh…)');
    await userEvent.click(screen.getByRole('button', { name: /^Cuối: đầu ra 7 × 7 × 1280/ }));
    expect(screen.getByTestId('network-detail')).toHaveTextContent('Conv_1 → Conv_1_bn → out_relu');
  });

  test('sơ đồ phễu: 5 tầng kích thước ảnh, ngoặc đóng băng, nút lớp đầu ra mang tên lớp', () => {
    render(<NetworkMap classNames={['Mèo', 'Chó', 'Gà']} isTraining={false} />);
    const map = screen.getByTestId('network-map');
    for (const size of ['112 × 112', '56 × 56', '28 × 28', '14 × 14', '7 × 7']) expect(map).toHaveTextContent(size);
    expect(screen.getByTestId('network-frozen')).toHaveTextContent('Đóng băng: 410.208 số');
    expect(screen.getAllByTestId('network-class').map((n) => n.textContent)).toEqual(['Mèo', 'Chó', 'Gà']);
    expect(screen.queryByTestId('network-input-image')).not.toBeInTheDocument();
  });

  test('có ảnh Huấn luyện thì ảnh đó là đầu vào; đang huấn luyện thì các đường nối chuyển động', () => {
    const image = { bytes: new Uint8Array([1, 2, 3]).buffer, mime: 'image/png', width: 1, height: 1 };
    render(<NetworkMap classNames={['Mèo', 'Chó']} isTraining inputImage={image} />);
    expect(screen.getByTestId('network-input-image')).toHaveAttribute('href', expect.stringMatching(/^blob:/));
    expect(screen.getByTestId('network-links')).toHaveClass('network-flow');
  });

  test('bấm bằng bàn phím: Enter chọn khối', async () => {
    render(<NetworkMap classNames={['Mèo', 'Chó']} isTraining={false} />);
    const block = screen.getByRole('button', { name: 'Khối 7: đầu ra 14 × 14 × 24, đóng băng' });
    block.focus();
    await userEvent.keyboard('{Enter}');
    expect(block).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('network-dense')).toHaveAttribute('aria-pressed', 'false');
  });
});
