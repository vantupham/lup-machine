import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ClassRecord, SampleRecord, StoredImage } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import { DataJourney } from '../DataJourney';
import { decodeStoredImage } from '../image-codec.browser';
import { DeepCheckPanel } from './DeepCheckPanel';

const SIZE = 224;

/** Ảnh giả: byte 0 = độ sáng nền, byte 1 = vị trí hình vuông (để các ảnh khác nhau). */
vi.mock('../image-codec.browser', () => ({
  decodeStoredImage: vi.fn(async (img: StoredImage) => {
    const [background, pos] = new Uint8Array(img.bytes);
    const data = new Uint8ClampedArray(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const inSquare = x >= pos! && x < pos! + 60 && y >= pos! && y < pos! + 60;
        const v = inSquare ? 255 - background! : background!;
        data.set([v, v, v, 255], (y * SIZE + x) * 4);
      }
    }
    return { width: SIZE, height: SIZE, data };
  }),
}));

const image = (background: number, pos: number): StoredImage => ({ bytes: new Uint8Array([background, pos]).buffer, mime: 'image/png', width: SIZE, height: SIZE });
const cls = (id: string, name: string, order: number): ClassRecord => ({ id, projectId: 'p', name, order, createdAt: '' });
const sample = (id: string, classId: string, split: 'train' | 'test', img: StoredImage): SampleRecord => ({
  id, projectId: 'p', classId, split, source: 'upload', image: img, createdAt: '',
});

const classes = [cls('a', 'Tròn', 0), cls('b', 'Vuông', 1)];
const leaked = image(220, 20);
const samples = [
  sample('s0', 'a', 'train', leaked),
  sample('s1', 'a', 'train', image(230, 90)),
  sample('s2', 'b', 'train', image(20, 40)),
  sample('s3', 'b', 'train', image(30, 130)),
  sample('s4', 'a', 'test', leaked),
];

beforeEach(async () => {
  await i18n.changeLanguage('vi');
  useModeStore.setState({ mode: 'explore' });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
});

describe('DeepCheckPanel', () => {
  test('soi kỹ: biểu đồ nền, cảnh báo lối tắt nền và ảnh Kiểm tra lộ đề', async () => {
    render(<DeepCheckPanel classes={classes} samples={samples} />);
    await userEvent.click(screen.getByRole('button', { name: 'Soi kỹ 5 ảnh' }));
    expect(await screen.findByText('Đã soi hết 5 ảnh.')).toBeInTheDocument();

    expect(screen.getByTestId('brightness-chart')).toHaveTextContent('Tròn');
    const findings = screen.getByRole('list', { name: 'Điều tìm thấy' });
    expect(findings).toHaveTextContent('Chỉ nhìn độ sáng nền đã phân biệt "Tròn" và "Vuông" đúng 100% ảnh Huấn luyện. Lớp "Tròn" nền sáng hơn hẳn.');
    expect(findings).toHaveTextContent('1 cặp ảnh Kiểm tra gần trùng ảnh Huấn luyện.');
    const pair = within(findings).getByTestId('duplicate-pair');
    expect(pair).toHaveTextContent('Ảnh 0 (Huấn luyện) và ảnh 4 (Kiểm tra)');
    expect(pair).toHaveTextContent('khác 0/256 ô');
    expect(within(pair).getAllByRole('img', { name: /Dấu vân tay 16 × 16/ })).toHaveLength(2);
  });

  test('mã Python chạy với số đo thật: dòng in khớp điều tìm thấy', async () => {
    render(<DeepCheckPanel classes={classes} samples={samples} />);
    const panel = screen.getByTestId('code-trace');
    await userEvent.click(within(panel).getByText('Mã Python'));
    expect(within(panel).getByText('Bấm Soi kỹ để chạy mã với ảnh của bạn.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Soi kỹ 5 ảnh' }));
    await screen.findByText('Đã soi hết 5 ảnh.');
    const jump = within(panel).getByRole('button', { name: /Đến dòng in tiếp theo/ });
    await userEvent.click(jump);
    await userEvent.click(jump);
    expect(within(panel).getByTestId('code-trace-console').textContent).toBe(
      'ảnh 0 (train) gần trùng ảnh 4 (test): khác 0 bit\nTròn / Vuông: chỉ nhìn nền đúng 100%, chênh 200',
    );
    expect(within(panel).getByText('Dòng 29')).toBeInTheDocument();
  });

  test('dữ liệu ổn thì báo không thấy vấn đề; có ảnh mới thì mời soi thêm', async () => {
    const varied = [
      sample('s1', 'a', 'train', image(230, 90)),
      sample('s2', 'a', 'train', image(25, 40)),
      sample('s3', 'b', 'train', image(220, 130)),
      sample('s5', 'b', 'train', image(35, 10)),
    ];
    const { rerender } = render(<DeepCheckPanel classes={classes} samples={varied} />);
    await userEvent.click(screen.getByRole('button', { name: 'Soi kỹ 4 ảnh' }));
    expect(await screen.findByText('Không thấy ảnh gần trùng hay lối tắt nền.')).toBeInTheDocument();
    rerender(<DeepCheckPanel classes={classes} samples={[...varied, sample('s6', 'b', 'test', image(100, 60))]} />);
    expect(screen.getByRole('button', { name: 'Soi thêm 1 ảnh mới' })).toBeInTheDocument();
  });

  test('không giải mã được ảnh: báo lỗi', async () => {
    vi.mocked(decodeStoredImage).mockRejectedValueOnce(new Error('ảnh hỏng'));
    render(<DeepCheckPanel classes={classes} samples={samples} />);
    await userEvent.click(screen.getByRole('button', { name: 'Soi kỹ 5 ảnh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không soi được ảnh: ảnh hỏng');
  });
});

describe('DataJourney', () => {
  test('ảnh → lớp → hai tập, số thật của dự án', () => {
    render(<DataJourney classCount={2} samples={samples} />);
    const journey = screen.getByRole('list', { name: 'Dữ liệu đi đâu' });
    expect(journey).toHaveTextContent('5 ảnh');
    expect(journey).toHaveTextContent('224 × 224 điểm × 3 màu = 150.528 số');
    expect(journey).toHaveTextContent('2 lớp');
    expect(journey).toHaveTextContent('4 Huấn luyện, 1 Kiểm tra');
  });
});
