import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { code, notebook } from '@/core/export/notebook';
import '@/i18n';
import { ColabExportPanel } from './ColabExportPanel';

describe('ColabExportPanel', () => {
  let created: Blob[];
  let clicked: string[];

  beforeEach(() => {
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

  test('bấm nút thì tải về tệp .ipynb hợp lệ, tên theo dự án', async () => {
    render(<ColabExportPanel projectName="Chim cánh cụt" descriptionKey="export.colab.tabularDescription" build={() => notebook([code('print(1)')])} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' }));
    expect(clicked).toEqual(['chim-canh-cut-lup-machine.ipynb']);
    expect(JSON.parse(await created[0]!.text())).toMatchObject({ nbformat: 4, cells: [{ cell_type: 'code' }] });
    expect(screen.getByRole('status')).toHaveTextContent(/Đã tạo notebook/);
  });

  test('lỗi khi dựng notebook được báo rõ, không tải gì', async () => {
    render(
      <ColabExportPanel
        projectName="x"
        descriptionKey="export.colab.imageDescription"
        build={() => {
          throw new RangeError('Không xuất được số không hữu hạn');
        }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tải notebook (.ipynb)' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Không tạo được notebook: Không xuất được số không hữu hạn');
    expect(clicked).toEqual([]);
  });
});
