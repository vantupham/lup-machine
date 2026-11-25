import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTestRepository, renderApp } from '../../../tests/setup/render';
import { PLAYGROUND_ALGOS } from './catalog';

function renderRoute(route: string) {
  return renderApp(route, createTestRepository().repository);
}

describe('trang Thuật toán', () => {
  test('liệt kê đủ 6 thuật toán và mở được từng trang', async () => {
    renderRoute('/playground');
    expect(screen.getByRole('heading', { level: 1, name: 'Thuật toán' })).toBeInTheDocument();
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('/playground/'));
    expect(links).toHaveLength(PLAYGROUND_ALGOS.length);
    await userEvent.click(screen.getByRole('link', { name: /Cây quyết định/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Cây quyết định' })).toBeInTheDocument();
  });

  test('mục điều hướng chính có Thuật toán', () => {
    renderRoute('/');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Thuật toán' })).toBeInTheDocument();
  });

  test('thuật toán không tồn tại thì hiện trang không tìm thấy', () => {
    renderRoute('/playground/khong-co');
    expect(screen.queryByRole('heading', { level: 1, name: 'Thuật toán' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chính xác')).not.toBeInTheDocument();
  });

  test.each(PLAYGROUND_ALGOS)('trang %s hiện nhãn "Chính xác" và hình 2D', (algo) => {
    renderRoute(`/playground/${algo}`);
    expect(screen.getByText('Chính xác')).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
  });
});

describe('k-NN', () => {
  test('đổi k thì số phiếu bầu đổi theo, tổng phiếu bằng k', async () => {
    renderRoute('/playground/knn');
    const votes = () =>
      within(screen.getByTestId('knn-votes'))
        .getAllByTestId('vote-count')
        .map((el) => Number(el.textContent));
    expect(votes().reduce((a, b) => a + b, 0)).toBe(3);
    fireEvent.change(screen.getByLabelText(/Số láng giềng k/), { target: { value: '5' } });
    expect(votes().reduce((a, b) => a + b, 0)).toBe(5);
    expect(screen.getByText(/\/5 phiếu/)).toBeInTheDocument();
  });

  test('xóa hết điểm thì không còn gì để đoán', async () => {
    renderRoute('/playground/knn');
    await userEvent.click(screen.getByRole('button', { name: 'Xóa hết điểm' }));
    expect(screen.getByText('Chưa có điểm nào để đoán.')).toBeInTheDocument();
  });
});

describe('cây quyết định', () => {
  test('trồng lại từ gốc rồi mọc từng nút', async () => {
    renderRoute('/playground/decision-tree');
    await userEvent.click(screen.getByRole('button', { name: 'Trồng lại từ gốc' }));
    expect(screen.getByText(/Đã mở 0\//)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mọc thêm một nút' }));
    expect(screen.getByText(/Đã mở 1\//)).toBeInTheDocument();
    expect(within(screen.getByTestId('tree-diagram')).getByText(/x[₁₂] ≤ /)).toBeInTheDocument();
  });
});

describe('hồi quy tuyến tính', () => {
  test('một bước gradient descent làm MSE của em giảm; hiện đường của máy', async () => {
    renderRoute('/playground/linear-regression');
    const mse = () => Number(screen.getByText('MSE đường của em').nextElementSibling?.textContent);
    const before = mse();
    await userEvent.click(screen.getByRole('button', { name: /Cho máy sửa một bước/ }));
    expect(mse()).toBeLessThan(before);
    await userEvent.click(screen.getByLabelText('Hiện đường của máy'));
    expect(screen.getByTestId('machine-line')).toHaveTextContent('Đường của máy');
    expect(Number(screen.getByText('MSE đường của máy').nextElementSibling?.textContent)).toBeLessThanOrEqual(mse());
  });
});

describe('gradient descent', () => {
  test('bấm "Một bước" chuyển sang bước 1; η quá lớn thì cảnh báo văng ra', async () => {
    renderRoute('/playground/gradient-descent');
    await userEvent.click(screen.getByRole('button', { name: 'Một bước' }));
    expect(screen.getByRole('heading', { name: 'Bước 1' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Learning rate η/), { target: { value: '1.1' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Một bước' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/η quá lớn/);
  });
});

describe('k-means', () => {
  test('các pha khởi đầu → gán → dời tâm', async () => {
    renderRoute('/playground/k-means');
    const phase = () => screen.getByTestId('kmeans-phase').textContent;
    expect(phase()).toMatch(/^Khởi đầu/);
    await userEvent.click(screen.getByRole('button', { name: 'Một bước' }));
    expect(phase()).toMatch(/^Gán/);
    await userEvent.click(screen.getByRole('button', { name: 'Một bước' }));
    expect(phase()).toMatch(/^Dời tâm/);
  });
});

describe('mạng nơ-ron mini', () => {
  test('huấn luyện vài bước làm loss xuất hiện và số bước tăng; có bản đồ từng nơ-ron', async () => {
    renderRoute('/playground/neural-network');
    expect(within(screen.getByTestId('neuron-maps')).getAllByRole('img')).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: /Huấn luyện 5 bước/ }));
    expect(screen.getByText('Số bước').nextElementSibling).toHaveTextContent('5');
    expect(screen.getByText('loss').nextElementSibling?.textContent).toMatch(/^\d+\.\d{3}$/);
  });

  test('đổi số nơ-ron thì khởi tạo lại mạng', async () => {
    renderRoute('/playground/neural-network');
    await userEvent.click(screen.getByRole('button', { name: /Huấn luyện 5 bước/ }));
    fireEvent.change(screen.getByLabelText(/Số nơ-ron mỗi tầng/), { target: { value: '5' } });
    expect(screen.getByText('Số bước').nextElementSibling).toHaveTextContent('0');
    expect(within(screen.getByTestId('neuron-maps')).getAllByRole('img')).toHaveLength(5);
  });
});
