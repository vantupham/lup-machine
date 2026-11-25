import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { createTestRepository, renderApp, type TestRepositories } from '../../../tests/setup/render';
import { fakeStoredJpeg } from '../../../tests/setup/fake-images';

function renderStudio(r: TestRepositories) {
  return renderApp('/studio', r.repository, r.dataset, r.experiments, r.tables, r.audio, r.poses, r.projectFiles);
}

describe('Xuất / mở tệp dự án .lup ở Xưởng mô hình', () => {
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

  test('xuất một dự án rồi mở lại tệp đó thành dự án mới', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Phân loại rác', projectType: 'image' });
    const cls = await r.dataset.addClass(project.id, 'Giấy');
    await r.dataset.addSamples([
      { projectId: project.id, classId: cls.id, split: 'train', source: 'upload', image: fakeStoredJpeg(1) },
    ]);
    const user = userEvent.setup();
    renderStudio(r);

    await user.click(await screen.findByRole('button', { name: 'Xuất tệp dự án Phân loại rác' }));
    await waitFor(() => expect(clicked).toEqual(['phan-loai-rac.lup']));
    // Thẻ dự án cũng tạo Blob cho ảnh thu nhỏ: lấy đúng tệp .zip vừa xuất.
    const zip = created.find((blob) => blob.type === 'application/zip');
    expect(zip).toBeDefined();

    const file = new File([await zip!.arrayBuffer()], 'phan-loai-rac.lup', { type: 'application/zip' });
    await user.upload(screen.getByLabelText('Chọn tệp .lup hoặc .lupa'), file);

    expect(await screen.findByRole('status')).toHaveTextContent('Đã mở dự án "Phân loại rác".');
    const list = screen.getByRole('list', { name: 'Dự án của em' });
    expect(await within(list).findAllByText('Phân loại rác')).toHaveLength(2);
    const all = await r.repository.findAll();
    const copy = all.find((p) => p.id !== project.id);
    expect(screen.getByRole('link', { name: /Mở dự án →/ })).toHaveAttribute('href', `/studio/${copy?.id}`);
    expect(await r.dataset.listSamples(copy!.id)).toHaveLength(1);
  });

  test('tệp không hợp lệ thì báo lỗi rõ ràng, không thêm dự án', async () => {
    const r = createTestRepository();
    const user = userEvent.setup();
    renderStudio(r);
    await user.upload(screen.getByLabelText('Chọn tệp .lup hoặc .lupa'), new File(['xin chào'], 'la.lup'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Không mở được tệp: .*không phải tệp dự án/);
    expect(await r.repository.findAll()).toHaveLength(0);
  });

  test('tệp quá lớn bị từ chối trước khi đọc', async () => {
    const r = createTestRepository();
    const user = userEvent.setup();
    renderStudio(r);
    const big = new File(['x'], 'to.lup');
    Object.defineProperty(big, 'size', { value: 257 * 1024 * 1024 });
    await user.upload(screen.getByLabelText('Chọn tệp .lup hoặc .lupa'), big);
    expect(await screen.findByRole('alert')).toHaveTextContent('Không mở được tệp: tệp lớn hơn 256 MB');
  });

  test('lỗi khi xuất được báo ngay dưới thẻ dự án', async () => {
    const r = createTestRepository();
    await r.repository.create({ name: 'Hỏng', projectType: 'image' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = { ...r.projectFiles, exportProject: vi.fn().mockRejectedValue(new Error('hết bộ nhớ')) };
    const user = userEvent.setup();
    renderApp('/studio', r.repository, r.dataset, r.experiments, r.tables, r.audio, r.poses, failing);
    await user.click(await screen.findByRole('button', { name: 'Xuất tệp dự án Hỏng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không xuất được: hết bộ nhớ');
    expect(clicked).toEqual([]);
  });
});
