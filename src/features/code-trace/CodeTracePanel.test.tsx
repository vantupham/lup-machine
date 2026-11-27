import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProgram } from '@/core/trace/program';
import { HELPERS_PROGRAM, SOFTMAX_PROGRAM, traceSoftmaxTraining, type TraceStep } from '@/core/trace/softmax-trace';
import { scalar } from '@/core/trace/trace-value';
import reference from '@/core/trace/softmax-trace.reference.json';
import '@/i18n';
import { CodeTracePanel } from './CodeTracePanel';
import { applyStep, INITIAL_STATE, MAX_OUTPUT_LINES, SPEED_DELAY_MS } from './useTracePlayer';

const train = { xs: reference.input.xs.map((r) => Float32Array.from(r)), ys: reference.input.ys };
const realTrace = () => traceSoftmaxTraining(train, null, reference.input.options);

const TINY = createProgram('tiny.py', 'x = 1\nx = x + 1\nprint(x)');
function* tinyTrace(): Generator<TraceStep, void, void> {
  yield { line: 0, epoch: 0, changed: { x: scalar(1, true) } };
  yield { line: 1, epoch: 0, changed: { x: scalar(2, true) } };
  yield { line: 2, epoch: 0, changed: {}, output: '2' };
}

async function openPanel() {
  await userEvent.click(screen.getByText('Mã Python'));
}

const currentLine = () => screen.getAllByRole('listitem').find((li) => li.getAttribute('aria-current') === 'step');

describe('CodeTracePanel', () => {
  test('chưa huấn luyện: hiện mã và lời nhắc, không có nút chạy', async () => {
    render(<CodeTracePanel program={SOFTMAX_PROGRAM} helpers={HELPERS_PROGRAM} create={null} />);
    await openPanel();
    expect(screen.getByText('Huấn luyện một lần để chạy mã với dữ liệu của bạn.')).toBeVisible();
    expect(screen.getByRole('list', { name: 'softmax_train.py' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Chạy 1 dòng/ })).not.toBeInTheDocument();
  });

  test('chạy từng dòng: tô sáng dòng, cập nhật biến và màn hình', async () => {
    render(<CodeTracePanel program={TINY} helpers={HELPERS_PROGRAM} create={tinyTrace} />);
    await openPanel();
    const step = screen.getByRole('button', { name: /Chạy 1 dòng/ });

    await userEvent.click(step);
    expect(currentLine()).toHaveTextContent('x = 1');
    const vars = screen.getByRole('region', { name: 'Biến' });
    expect(within(vars).getByText('x').closest('[data-changed]')).toHaveTextContent('x (vừa đổi)= 1');

    await userEvent.click(step);
    expect(currentLine()).toHaveTextContent('x = x + 1');
    expect(within(vars).getByText('x').parentElement).toHaveTextContent('x (vừa đổi)= 2');

    await userEvent.click(step);
    expect(screen.getByTestId('code-trace-console')).toHaveTextContent('2');
    await userEvent.click(step);
    expect(screen.getByText('Chương trình đã chạy xong.')).toBeInTheDocument();
    expect(step).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /Về đầu/ }));
    expect(currentLine()).toBeUndefined();
    expect(screen.getByText('Chưa in dòng nào.')).toBeInTheDocument();
  });

  test('"Đến hết epoch" chạy đến dòng print với số liệu thật như bản Python', async () => {
    render(<CodeTracePanel program={SOFTMAX_PROGRAM} helpers={HELPERS_PROGRAM} create={realTrace} />);
    await openPanel();
    const jump = screen.getByRole('button', { name: /Đến hết epoch/ });
    await userEvent.click(jump);
    await userEvent.click(jump);
    expect(screen.getByTestId('code-trace-console').textContent).toBe(reference.output.slice(0, 2).join('\n'));
    expect(currentLine()).toHaveTextContent('print(f"epoch');
    expect(screen.getByText('Epoch 2 · dòng 27')).toBeInTheDocument();
  });

  test('Chạy tự động theo tốc độ rồi Tạm dừng', async () => {
    vi.useFakeTimers();
    try {
      render(<CodeTracePanel program={TINY} helpers={HELPERS_PROGRAM} create={tinyTrace} />);
      act(() => screen.getByText('Mã Python').click());
      // Sự kiện toggle của <details> đến sau một nhịp hẹn giờ.
      act(() => vi.advanceTimersByTime(1));
      act(() => screen.getByRole('button', { name: /^Chạy$/ }).click());
      act(() => vi.advanceTimersByTime(SPEED_DELAY_MS.medium));
      expect(currentLine()).toHaveTextContent('x = 1');
      act(() => vi.advanceTimersByTime(SPEED_DELAY_MS.medium));
      expect(currentLine()).toHaveTextContent('x = x + 1');
      act(() => screen.getByRole('button', { name: /Tạm dừng/ }).click());
      act(() => vi.advanceTimersByTime(SPEED_DELAY_MS.medium * 5));
      expect(currentLine()).toHaveTextContent('x = x + 1');
    } finally {
      vi.useRealTimers();
    }
  });

  test('lần huấn luyện mới (hàm tạo vết mới) thì bắt đầu lại từ đầu', async () => {
    const { rerender } = render(<CodeTracePanel program={TINY} helpers={HELPERS_PROGRAM} create={tinyTrace} />);
    await openPanel();
    await userEvent.click(screen.getByRole('button', { name: /Chạy 1 dòng/ }));
    expect(currentLine()).toBeDefined();
    rerender(<CodeTracePanel program={TINY} helpers={HELPERS_PROGRAM} create={() => tinyTrace()} />);
    expect(currentLine()).toBeUndefined();
  });

  test('có phần hàm hỗ trợ', async () => {
    render(<CodeTracePanel program={SOFTMAX_PROGRAM} helpers={HELPERS_PROGRAM} create={null} />);
    await openPanel();
    await userEvent.click(screen.getByText('Hàm hỗ trợ (lup_helpers.py)'));
    expect(screen.getByRole('list', { name: 'lup_helpers.py' })).toBeVisible();
  });
});

describe('applyStep', () => {
  test('giữ thứ tự biến, chỉ đánh dấu biến vừa đổi, không sửa trạng thái cũ', () => {
    const a = applyStep(INITIAL_STATE, { line: 0, epoch: 0, changed: { x: scalar(1), y: scalar(2) } });
    const b = applyStep(a, { line: 1, epoch: 0, changed: { y: scalar(3), z: scalar(4) } });
    expect(b.vars.map(([n]) => n)).toEqual(['x', 'y', 'z']);
    expect(b.changed).toEqual(['y', 'z']);
    expect(a.vars[1]![1]).toEqual(scalar(2));
  });

  test('màn hình chỉ giữ các dòng gần nhất', () => {
    let state = INITIAL_STATE;
    for (let i = 0; i < MAX_OUTPUT_LINES + 5; i++) state = applyStep(state, { line: 0, epoch: 0, changed: {}, output: String(i) });
    expect(state.output).toHaveLength(MAX_OUTPUT_LINES);
    expect(state.output[0]).toBe('5');
  });
});
