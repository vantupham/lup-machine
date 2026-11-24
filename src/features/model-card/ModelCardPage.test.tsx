import { configure, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { createTestRepository, renderWithRepositories } from '../../../tests/setup/render';

const answers = {
  'Mô hình dùng để làm gì?': 'Phân loại rác để bỏ đúng thùng',
  'Dữ liệu lấy từ đâu?': 'Cả lớp tự chụp, 40 ảnh',
  'Mô hình làm tốt đến đâu?': 'Đúng 9/10 ảnh Kiểm tra',
  'Khi nào mô hình dễ sai?': 'Ảnh chụp tối',
  'Không nên dùng mô hình này để…': 'Phạt bạn bỏ rác sai',
};

// Gõ đủ 5 câu trả lời: khi cả bộ kiểm thử chạy song song, máy chậm hơn nhiều so với khi chạy riêng.
configure({ asyncUtilTimeout: 10_000 });

describe('Thẻ mô hình', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
  });

  test('điền đủ 5 câu, lưu, rồi mở lại vẫn còn; liên kết ở studio báo đã điền đủ', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Phân loại rác', projectType: 'tabular' });
    const user = userEvent.setup();
    const view = renderWithRepositories(`/studio/${project.id}/the-mo-hinh`, r);

    expect(await screen.findByRole('heading', { level: 1, name: 'Phân loại rác' })).toBeInTheDocument();
    expect(screen.getByTestId('model-card-completeness')).toHaveTextContent('Còn thiếu: mục đích, nguồn dữ liệu, độ chính xác, khi nào dễ sai, không nên dùng để.');
    expect(screen.getByRole('button', { name: 'Lưu thẻ' })).toBeDisabled();

    await user.type(screen.getByLabelText('Người làm'), 'Nhóm 2');
    for (const [label, text] of Object.entries(answers)) await user.type(screen.getByLabelText(new RegExp(label.replace('?', '\\?'))), text);
    expect(screen.getByText('Có thay đổi chưa lưu.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lưu thẻ' }));

    expect(await screen.findByText('Đã lưu thẻ mô hình.')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('model-card-completeness')).toHaveTextContent('Đã trả lời đủ 5 câu hỏi.');
    expect(await r.modelCards.get(project.id)).toMatchObject({ authors: 'Nhóm 2', misuse: 'Phạt bạn bỏ rác sai' });
    expect(within(screen.getByTestId('model-card-print')).getByText('Đúng 9/10 ảnh Kiểm tra')).toBeInTheDocument();
    view.unmount();

    renderWithRepositories(`/studio/${project.id}`, r);
    expect(await screen.findByRole('link', { name: /Thẻ mô hình · đã điền đủ/ })).toHaveAttribute('href', `/studio/${project.id}/the-mo-hinh`);
  }, 30_000);

  test('hiện số liệu tự động của dự án; liên kết báo chưa điền đủ', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Âm thanh', projectType: 'audio' });
    await r.dataset.addClass(project.id, 'Vỗ tay');
    const view = renderWithRepositories(`/studio/${project.id}/the-mo-hinh`, r);
    const facts = await screen.findByTestId('model-card-facts');
    expect(facts).toHaveTextContent('Loại dự án: Âm thanh');
    expect(facts).toHaveTextContent('Vỗ tay: 0 mẫu');
    view.unmount();
    renderWithRepositories(`/studio/${project.id}`, r);
    expect(await screen.findByRole('link', { name: /Thẻ mô hình · chưa điền đủ/ })).toBeInTheDocument();
  });

  test('lỗi khi lưu được báo rõ', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'A', projectType: 'text' });
    vi.spyOn(r.modelCards, 'save').mockRejectedValue(new Error('bộ nhớ đầy'));
    const user = userEvent.setup();
    renderWithRepositories(`/studio/${project.id}/the-mo-hinh`, r);
    await user.type(await screen.findByLabelText(/Mô hình dùng để làm gì/), 'x');
    await user.click(screen.getByRole('button', { name: 'Lưu thẻ' }));
    expect(await screen.findByText('Không lưu được: bộ nhớ đầy')).toHaveAttribute('role', 'alert');
  });

  test('bản in theo nội dung đang gõ, kể cả chưa lưu', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'In', projectType: 'pose' });
    const user = userEvent.setup();
    renderWithRepositories(`/studio/${project.id}/the-mo-hinh`, r);
    await user.type(await screen.findByLabelText(/Khi nào mô hình dễ sai/), 'Đứng ngược sáng');
    expect(within(screen.getByTestId('model-card-print')).getByText('Đứng ngược sáng')).toBeInTheDocument();
  });

  test('dự án không tồn tại', async () => {
    renderWithRepositories('/studio/khong-co/the-mo-hinh', createTestRepository());
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy dự án này trên máy.');
  });
});
