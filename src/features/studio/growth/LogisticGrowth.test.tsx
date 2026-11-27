import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { LogisticGrowth } from './LogisticGrowth';
import { WordWeights } from './WordWeights';

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

const xs = [[0, 1], [0.2, 0.8], [1, 0], [0.9, 0.1]];
const ys = [0, 0, 1, 1];

describe('LogisticGrowth: hình dạng tự nhiên của hàng trọng số', () => {
  test('2 lớp: một hàng nghiêng về lớp thứ 2, renderRow nhận đúng lớp và tiêu đề', async () => {
    const calls: [number, string][] = [];
    render(
      <LogisticGrowth
        xs={xs}
        ys={ys}
        numClasses={2}
        c={1}
        classNames={['Chê', 'Khen']}
        featureNames={['a', 'b']}
        renderRow={(row, cls, title) => {
          calls.push([cls, title]);
          return <span>{`hình ${row.length}`}</span>;
        }}
      />,
    );
    await userEvent.click(screen.getByText(/Xem máy học qua từng vòng lặp/));
    expect(screen.getByTestId('logistic-shape-0')).toHaveTextContent('hình 2');
    expect(screen.queryByTestId('logistic-shape-1')).toBeNull();
    expect(calls.at(-1)?.[0]).toBe(1);
    expect(calls.at(-1)?.[1]).toContain('Khen');
  });

  test('không có renderRow thì chỉ có thanh trọng số', async () => {
    render(<LogisticGrowth xs={xs} ys={ys} numClasses={2} c={1} classNames={['Chê', 'Khen']} featureNames={['a', 'b']} />);
    await userEvent.click(screen.getByText(/Xem máy học qua từng vòng lặp/));
    expect(screen.queryByTestId('logistic-shape-0')).toBeNull();
  });
});

describe('WordWeights', () => {
  test('từ dương kéo về, từ âm đẩy ra; lớn nhất trước, chữ to hơn', () => {
    render(<WordWeights weights={[0.5, -1, 2, 0, -0.2]} terms={['ngon', 'chán', 'tuyệt', 'và', 'chậm']} label="Nghiêng về Khen" />);
    const box = screen.getByTestId('word-weights');
    const lists = within(box).getAllByRole('list');
    expect(within(lists[0]!).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['tuyệt', 'ngon']);
    expect(within(lists[1]!).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['chán', 'chậm']);
    const size = (text: string) => parseFloat(within(box).getByText(text).style.fontSize);
    expect(size('tuyệt')).toBeGreaterThan(size('ngon'));
    expect(box).not.toHaveTextContent('và');
  });
});
