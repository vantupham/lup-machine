import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { decodeAssignmentPackage, decodeSubmissionPackage } from '@/storage/classroom/package';
import { createTestRepository, renderWithRepositories } from '../../../tests/setup/render';

// Luồng trọn vòng dài: khi cả bộ kiểm thử chạy song song, máy chậm hơn nhiều so với khi chạy riêng.
configure({ asyncUtilTimeout: 10_000 });

describe('Lớp học qua tệp: giáo viên tạo gói, học sinh làm và nộp', () => {
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

  async function lastDownload(): Promise<Uint8Array> {
    await waitFor(() => expect(created.length).toBeGreaterThan(0));
    return new Uint8Array(await created.at(-1)!.arrayBuffer());
  }

  test('giáo viên: báo lỗi khi thiếu tên bài; rubric mặc định 3 tiêu chí, 10 điểm', async () => {
    const user = userEvent.setup();
    renderWithRepositories('/giao-vien', createTestRepository());
    expect(screen.getByTestId('rubric-total')).toHaveTextContent('Tổng: 10 điểm');
    await user.click(screen.getByRole('button', { name: 'Tải gói bài tập (.lupa)' }));
    expect(await screen.findByText('Cần đặt tên bài.')).toHaveAttribute('role', 'alert');
    await user.click(screen.getByRole('button', { name: 'Xóa tiêu chí 3' }));
    expect(screen.getByTestId('rubric-total')).toHaveTextContent('Tổng: 7 điểm');
    await user.click(screen.getByRole('button', { name: 'Thêm câu hỏi' }));
    await user.type(screen.getByLabelText('Tên bài'), 'Bài 1');
    await user.click(screen.getByRole('button', { name: 'Tải gói bài tập (.lupa)' }));
    expect(await screen.findByText('Câu hỏi không được để trống.')).toBeInTheDocument();
    expect(clicked).toEqual([]);
  });

  test('trọn vòng: tạo gói → học sinh mở → trả lời → điền thẻ → nộp bài không kèm dữ liệu gốc', async () => {
    const user = userEvent.setup();
    const teacher = createTestRepository();
    const teacherView = renderWithRepositories('/giao-vien', teacher);
    await user.type(screen.getByLabelText('Tên bài'), 'Phân loại ý kiến');
    await user.type(screen.getByLabelText('Giáo viên'), 'Cô Hà');
    await user.click(screen.getByRole('radio', { name: 'Văn bản' }));
    await user.type(screen.getByLabelText('Đề bài'), 'Dạy máy phân biệt khen và chê.');
    await user.click(screen.getByRole('button', { name: 'Thêm câu hỏi' }));
    await user.type(screen.getByLabelText('Câu hỏi 1'), 'Câu nào máy hay đoán sai?');
    await user.click(screen.getByRole('button', { name: 'Tải gói bài tập (.lupa)' }));
    expect(await screen.findByText('Đã tạo phan-loai-y-kien.lupa. Gửi tệp này cho học sinh.')).toBeInTheDocument();
    const lupa = await lastDownload();
    expect(decodeAssignmentPackage(lupa).assignment).toMatchObject({ title: 'Phân loại ý kiến', teacher: 'Cô Hà', projectType: 'text', questions: ['Câu nào máy hay đoán sai?'] });
    teacherView.unmount();

    // học sinh mở gói ở trang Mô hình
    const student = createTestRepository();
    const studio = renderWithRepositories('/studio', student);
    await user.upload(screen.getByLabelText('Chọn tệp .lup hoặc .lupa'), new File([lupa as Uint8Array<ArrayBuffer>], 'phan-loai-y-kien.lupa'));
    expect(await screen.findByText(/Đã mở bài tập "Phân loại ý kiến"/)).toBeInTheDocument();
    const [project] = await student.repository.findAll();
    studio.unmount();

    // trang dự án có dải bài tập
    const projectView = renderWithRepositories(`/studio/${project!.id}`, student);
    const banner = await screen.findByRole('complementary', { name: 'Bài tập' });
    expect(within(banner).getByText('Phân loại ý kiến')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'Làm bài và nộp bài' })).toHaveAttribute('href', `/studio/${project!.id}/bai-tap`);
    projectView.unmount();

    // trang làm bài
    renderWithRepositories(`/studio/${project!.id}/bai-tap`, student);
    expect(await screen.findByText('Dạy máy phân biệt khen và chê.')).toBeInTheDocument();
    const checklist = screen.getByTestId('submit-checklist');
    await waitFor(() => expect(checklist).toHaveTextContent('Ghi họ tên học sinh.'));
    expect(checklist).toHaveTextContent('Điền đủ Thẻ mô hình.');
    expect(checklist).toHaveTextContent('Trả lời và lưu đủ các câu hỏi.');
    expect(screen.getByRole('button', { name: 'Tải bài nộp (.lups)' })).toBeDisabled();

    await user.type(screen.getByLabelText('1. Câu nào máy hay đoán sai?'), 'Câu mỉa mai');
    expect(checklist).toHaveTextContent('Lưu câu trả lời trước khi nộp.');
    await user.click(screen.getByRole('button', { name: 'Lưu câu trả lời' }));
    expect(await screen.findByText('Đã lưu câu trả lời.')).toBeInTheDocument();
    await student.modelCards.save(project!.id, { authors: 'An', purpose: 'a', data: 'b', performance: 'c', limitations: 'd', misuse: 'e' });
    await user.type(screen.getByLabelText('Họ tên học sinh'), 'Nguyễn An');
    await user.type(screen.getByLabelText('Lớp'), '8B');
    // điều kiện thẻ mô hình được kiểm tra lại khi câu trả lời được lưu lần nữa
    await user.type(screen.getByLabelText('1. Câu nào máy hay đoán sai?'), '!');
    await user.click(screen.getByRole('button', { name: 'Lưu câu trả lời' }));
    await waitFor(() => expect(checklist).toHaveTextContent('Đã đủ điều kiện nộp bài.'));
    expect(screen.getByRole('checkbox', { name: /Kèm dữ liệu gốc/ })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Tải bài nộp (.lups)' }));
    expect(await screen.findByText('Đã tạo phan-loai-y-kien-nguyen-an.lups. Gửi tệp này cho thầy cô.')).toBeInTheDocument();
    const { submission } = decodeSubmissionPackage(await lastDownload());
    expect(submission).toMatchObject({ submitter: { students: 'Nguyễn An', className: '8B' }, answers: ['Câu mỉa mai!'], includesData: false });
  }, 30_000);

  test('dự án không gắn bài tập', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Thường', projectType: 'pose' });
    renderWithRepositories(`/studio/${project.id}/bai-tap`, r);
    expect(await screen.findByRole('alert')).toHaveTextContent('Dự án này không gắn với bài tập nào.');
  });

  test('mở nhầm bài nộp ở chỗ mở gói bài tập thì báo rõ', async () => {
    const user = userEvent.setup();
    const r = createTestRepository();
    renderWithRepositories('/studio', r);
    await user.upload(screen.getByLabelText('Chọn tệp .lup hoặc .lupa'), new File(['không phải zip'], 'bai.lupa'));
    expect(await screen.findByText(/Không mở được tệp: .*không phải tệp của LUP Machine/)).toBeInTheDocument();
    expect(await r.repository.findAll()).toHaveLength(0);
  });
});
