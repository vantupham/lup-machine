import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { FindingsPanel } from './FindingsPanel';
import type { SamplePrediction } from './lab-data';

const classes: ClassRecord[] = ['Mèo', 'Chó', 'Thỏ'].map((name, order) => ({ id: `c${order}`, projectId: 'p', name, order, createdAt: '' }));

function sample(id: string, classIndex: number): SampleRecord {
  return {
    id,
    projectId: 'p',
    classId: `c${classIndex}`,
    split: 'test',
    source: 'upload',
    image: { bytes: new Uint8Array([1]).buffer, mime: 'image/jpeg', width: 224, height: 224 },
    createdAt: '',
  };
}

function prediction(actual: number, predicted: number, confidence: number): SamplePrediction {
  const probabilities = new Float64Array(3).fill((1 - confidence) / 2);
  probabilities[predicted] = confidence;
  return { actual, predicted, isCorrect: actual === predicted, probabilities };
}

/** 10 mèo (3 bị đoán là chó, 2 trong đó máy rất chắc), 10 chó đúng hết, 4 thỏ (3 bị đoán là mèo). */
function setup() {
  const entries: [SampleRecord, SamplePrediction][] = [
    ...Array.from({ length: 7 }, (_, i): [SampleRecord, SamplePrediction] => [sample(`m${i}`, 0), prediction(0, 0, 0.9)]),
    [sample('m-sure-1', 0), prediction(0, 1, 0.93)],
    [sample('m-sure-2', 0), prediction(0, 1, 0.81)],
    [sample('m-unsure', 0), prediction(0, 1, 0.5)],
    ...Array.from({ length: 10 }, (_, i): [SampleRecord, SamplePrediction] => [sample(`c${i}`, 1), prediction(1, 1, 0.9)]),
    [sample('t0', 2), prediction(2, 2, 0.6)],
    ...Array.from({ length: 3 }, (_, i): [SampleRecord, SamplePrediction] => [sample(`t-wrong-${i}`, 2), prediction(2, 0, 0.6)]),
  ];
  const onShowCell = vi.fn();
  const onInspect = vi.fn();
  render(
    <FindingsPanel
      classes={classes}
      split="test"
      samples={entries.map(([s]) => s)}
      predictions={new Map(entries.map(([s, p]) => [s.id, p]))}
      onShowCell={onShowCell}
      onInspect={onInspect}
    />,
  );
  return { onShowCell, onInspect };
}

beforeEach(async () => {
  await i18n.changeLanguage('vi');
});

describe('Điểm đáng chú ý', () => {
  test('cặp nhầm nhiều nhất và lớp khó nhất, mỗi phát hiện kèm câu hỏi "Vì sao?" và nút xem ảnh', async () => {
    const { onShowCell } = setup();
    const top = screen.getByTestId('finding-top-confusion');
    expect(top).toHaveTextContent('Hay nhầm nhất: 3/10 ảnh Mèo bị đoán là Chó.');
    expect(top).toHaveTextContent('Vì sao? Ảnh Mèo và ảnh Chó giống nhau ở điểm nào?');

    const weakest = screen.getByTestId('finding-weakest-class');
    expect(weakest).toHaveTextContent('Lớp khó nhất: máy chỉ nhận ra 25% ảnh Thỏ (4 ảnh), hay nhầm sang Mèo.');

    await userEvent.click(within(top).getByRole('button', { name: 'Xem các ảnh này' }));
    expect(onShowCell).toHaveBeenLastCalledWith(0, 1);
    await userEvent.click(within(weakest).getByRole('button', { name: 'Xem các ảnh này' }));
    expect(onShowCell).toHaveBeenLastCalledWith(2, 0);
  });

  test('ảnh sai mà máy vẫn tin từ 80%: hiện ảnh, tin nhất trước, bấm để xem vì sao', async () => {
    const { onInspect } = setup();
    const confident = screen.getByTestId('finding-confident-mistakes');
    expect(confident).toHaveTextContent('2 ảnh sai mà máy vẫn tin từ 80% trở lên.');
    const thumbs = within(confident).getAllByRole('button');
    expect(thumbs.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ảnh Mèo bị đoán là Chó (93%). Xem vì sao',
      'Ảnh Mèo bị đoán là Chó (81%). Xem vì sao',
    ]);
    await userEvent.click(thumbs[0]!);
    expect(onInspect).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-sure-1' }));
  });

  test('chưa có dự đoán nào thì không hiện', () => {
    const { container } = render(
      <FindingsPanel classes={classes} split="test" samples={[]} predictions={new Map()} onShowCell={vi.fn()} onInspect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
