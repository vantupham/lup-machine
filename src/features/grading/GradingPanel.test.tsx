import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unzipSync } from 'fflate';
import i18n from '@/i18n';
import { encodeSubmissionPackage } from '@/storage/classroom/package';
import { CURRENT_FORMAT_VERSION } from '@/storage/schemas/manifest';
import type { Submission } from '@/storage/schemas/assignment';
import type { ProjectBundle } from '@/storage/project-file/bundle';
import { createTestRepository, renderWithRepositories } from '../../../tests/setup/render';
import { sampleAssignment } from '../../../tests/setup/sample-assignment';

// Luồng chấm bài dài: khi cả bộ kiểm thử chạy song song, máy chậm hơn nhiều so với khi chạy riêng.
configure({ asyncUtilTimeout: 10_000 });

const meta = { appVersion: '0.1.0', createdAt: '2026-11-25T10:00:00.000Z' };
const card = { authors: 'An', purpose: 'Phân loại rác', data: 'Tự chụp', performance: '80%', limitations: 'Ảnh tối', misuse: 'Phạt bạn' };

function project(): ProjectBundle {
  return {
    manifest: { formatVersion: CURRENT_FORMAT_VERSION, appVersion: '0.1.0', projectType: 'image', name: 'x', createdAt: meta.createdAt },
    classes: ['Giấy', 'Nhựa'],
    images: [],
    clips: [],
    poses: [],
    table: null,
    runs: [],
    modelCard: card,
    notes: [],
  trials: [],
  };
}

function lups(students: string, accuracy: number, extra: Partial<ProjectBundle> = {}): File {
  const submission: Submission = {
    assignment: sampleAssignment,
    submitter: { students, className: '7A' },
    answers: [`Trả lời của ${students}`, 'Chụp thêm'],
    submittedAt: '2026-11-25T10:00:00.000Z',
    includesData: false,
    summary: { projectType: 'image', classes: [{ name: 'Giấy', count: 20, train: 15, test: 5 }], table: null, latestRun: { number: 2, epochs: 20, trainAccuracy: 1, testAccuracy: accuracy, matchesData: false } },
  };
  return new File([encodeSubmissionPackage({ submission, project: { ...project(), ...extra } }, meta) as Uint8Array<ArrayBuffer>], `${students}.lups`);
}

describe('Góc giáo viên – chấm bài', () => {
  let created: Blob[];
  let clicked: string[];

  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    created = [];
    clicked = [];
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        created.push(blob);
        return 'blob:lup-test';
      }),
      revokeObjectURL: vi.fn(),
    }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('tab Chấm bài nằm trên URL; chưa có bài nộp', async () => {
    renderWithRepositories('/giao-vien?tab=cham-bai', createTestRepository());
    expect(screen.getByRole('tab', { name: 'Chấm bài' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Chưa nhận bài nộp nào.')).toBeInTheDocument();
  });

  test('nhận nhiều bài, chấm theo rubric, xem câu trả lời và thẻ mô hình, xuất Excel', async () => {
    const user = userEvent.setup();
    const r = createTestRepository();
    renderWithRepositories('/giao-vien', r);
    await user.click(screen.getByRole('tab', { name: 'Chấm bài' }));

    await user.upload(screen.getByLabelText('Chọn tệp .lups'), [lups('Bình', 0.5), lups('An', 0.9), new File(['hỏng'], 'hong.lups')]);
    const results = await screen.findByTestId('import-results');
    await waitFor(() => expect(results).toHaveTextContent('Bình.lups (Bình): Đã nhận'));
    expect(results).toHaveTextContent('hong.lups: Không đọc được');

    const table = await screen.findByTestId('submissions-table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3));
    expect(within(table).getAllByRole('rowheader').map((c) => c.textContent)).toEqual(['An', 'Bình']);
    expect(screen.getByTestId('class-stats')).toHaveTextContent('Đã chấm 0/2 bài');
    expect(screen.getByTestId('class-stats')).toHaveTextContent('Độ chính xác Kiểm tra trung bình: 70%');

    await user.click(within(table).getByRole('button', { name: 'Chấm bài An' }));
    const detail = await screen.findByRole('region', { name: 'Bài của An' });
    expect(within(detail).getByText('Trả lời của An')).toBeInTheDocument();
    expect(within(detail).getByText('Ảnh tối')).toBeInTheDocument();
    await user.type(within(detail).getByLabelText(/Dữ liệu \(tối đa 4\)/), '3,5');
    const cardScore = within(detail).getByLabelText(/Thẻ mô hình \(tối đa 6\)/);
    await user.type(cardScore, '9');
    // vượt điểm tối đa: báo lỗi ngay, không âm thầm hạ điểm, chưa cho lưu
    expect(cardScore).toHaveAttribute('aria-invalid', 'true');
    expect(within(detail).getByText('Điểm từ 0 đến 6, ví dụ 2,5.')).toBeInTheDocument();
    expect(within(detail).getByRole('button', { name: 'Lưu điểm' })).toBeDisabled();
    await user.clear(cardScore);
    await user.type(cardScore, '6');
    expect(within(detail).getByTestId('grade-total')).toHaveTextContent('Tổng: 9,5/10');
    await user.type(within(detail).getByLabelText('Nhận xét'), 'Thẻ mô hình tốt');
    await user.click(within(detail).getByRole('button', { name: 'Lưu điểm' }));
    expect(await within(detail).findByText('Đã lưu điểm.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('class-stats')).toHaveTextContent('Đã chấm 1/2 bài'));
    expect(screen.getByTestId('class-stats')).toHaveTextContent('Điểm trung bình: 9,5/10');

    await user.click(screen.getByRole('button', { name: 'Xuất bảng điểm Excel (.xlsx)' }));
    await waitFor(() => expect(clicked).toEqual(['phan-loai-rac-bang-anh-bang-diem.xlsx']));
    const sheet = new TextDecoder().decode(unzipSync(new Uint8Array(await created.at(-1)!.arrayBuffer()))['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('>An<');
    expect(sheet).toContain('<v>9.5</v>');
    expect(sheet).toContain('Thẻ mô hình tốt');
  }, 30_000);

  test('mở dự án của học sinh thành dự án trong trang Mô hình của giáo viên', async () => {
    const user = userEvent.setup();
    const r = createTestRepository();
    renderWithRepositories('/giao-vien?tab=cham-bai', r);
    await user.upload(screen.getByLabelText('Chọn tệp .lups'), [lups('Chi', 0.8)]);
    await user.click(await screen.findByRole('button', { name: 'Chấm bài Chi' }));
    await user.click(screen.getByRole('button', { name: 'Mở dự án của học sinh' }));
    expect(await screen.findByText(/Đã tạo dự án "Chi – Phân loại rác bằng ảnh"/)).toBeInTheDocument();
    const [created] = await r.repository.findAll();
    expect(created?.name).toBe('Chi – Phân loại rác bằng ảnh');
    expect((await r.modelCards.get(created!.id))?.purpose).toBe('Phân loại rác');
  });

  test('xem Sổ tay và các lần thí nghiệm của học sinh trong bài nộp', async () => {
    const user = userEvent.setup();
    const options = { epochs: 50, learningRate: 0.001, batchSize: 16, seed: 42 };
    const run = (number: number, epochs: number, test: number) => ({
      number,
      createdAt: '2026-11-25T09:00:00.000Z',
      fingerprint: 'f1',
      matchesData: false,
      options: { ...options, epochs },
      classNames: ['Giấy', 'Nhựa'],
      counts: { train: 30, test: 10 },
      metrics: [{ epoch: epochs, trainLoss: 0.1, trainAccuracy: 1, testLoss: 0.3, testAccuracy: test }],
    });
    const file = lups('Dũng', 0.8, {
      notes: [{ step: 'evaluate', text: 'Hay nhầm nhựa trong với giấy trắng' }],
      runs: [{ ...run(1, 50, 0.7), guess: { testAccuracy: 0.9 } }, { ...run(2, 200, 0.8), conclusion: 'Học lâu hơn thì tăng 10 điểm' }],
    });
    renderWithRepositories('/giao-vien?tab=cham-bai', createTestRepository());
    await user.upload(screen.getByLabelText('Chọn tệp .lups'), [file]);
    await user.click(await screen.findByRole('button', { name: 'Chấm bài Dũng' }));

    const inquiry = await screen.findByRole('region', { name: 'Sổ tay và thí nghiệm' });
    expect(await within(inquiry).findByTestId('inquiry-summary')).toHaveTextContent('1/6 bước có ghi chép · 2 lần chạy · 1 lần đoán trước · 1 lần có kết luận');
    expect(within(inquiry).getByTestId('inquiry-note-evaluate')).toHaveTextContent('Hay nhầm nhựa trong với giấy trắng');
    const rows = within(within(inquiry).getByRole('table', { name: 'Các lần huấn luyện' })).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['#1Lần đầu90%70%', '#2số epoch 50 → 200–80%Học lâu hơn thì tăng 10 điểm']);
  });

  test('xóa một bài nộp và xóa cả bài tập', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const r = createTestRepository();
    renderWithRepositories('/giao-vien?tab=cham-bai', r);
    await user.upload(screen.getByLabelText('Chọn tệp .lups'), [lups('An', 0.9), lups('Bình', 0.5)]);
    await user.click(await screen.findByRole('button', { name: 'Chấm bài An' }));
    await user.click(screen.getByRole('button', { name: 'Xóa bài nộp này' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chấm bài An' })).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Xóa mọi bài nộp của bài tập này' }));
    expect(await screen.findByText('Chưa nhận bài nộp nào.')).toBeInTheDocument();
  });
});
