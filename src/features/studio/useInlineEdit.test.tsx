import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useInlineEdit } from './useInlineEdit';

/** Ô tên tối giản dùng hook, có một nút khác để thử "bấm ra ngoài". */
function NameField({ initial, onSave }: { readonly initial: string; readonly onSave: (next: string) => Promise<boolean> }) {
  const [name, setName] = useState(initial);
  const { isEditing, start, triggerRef, inputRef, inputProps } = useInlineEdit({
    value: name,
    onSave: async (next) => {
      const ok = await onSave(next);
      if (ok) setName(next);
      return ok;
    },
  });
  return (
    <div>
      {isEditing ? (
        <input ref={inputRef} {...inputProps} aria-label="Tên" />
      ) : (
        <>
          <span data-testid="shown">{name}</span>
          <button ref={triggerRef} type="button" onClick={start}>
            Sửa
          </button>
        </>
      )}
      <button type="button">Chỗ khác</button>
    </div>
  );
}

function setup(onSave: (next: string) => Promise<boolean> = async () => true) {
  const save = vi.fn(onSave);
  render(<NameField initial="Nhựa" onSave={save} />);
  return save;
}

async function openAndType(text: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));
  const input = screen.getByRole('textbox', { name: 'Tên' });
  await userEvent.clear(input);
  if (text) await userEvent.type(input, text);
  return input;
}

describe('useInlineEdit: sửa tên tại chỗ, tự lưu', () => {
  test('mở ô thì con trỏ ở ô và chọn sẵn tên cũ', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Tên' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('Nhựa');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
  });

  test('Enter thì lưu đúng một lần (cắt khoảng trắng) và trả con trỏ về bút chì', async () => {
    const save = setup();
    await openAndType('  Chai nhựa  {Enter}');
    expect(await screen.findByTestId('shown')).toHaveTextContent('Chai nhựa');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('Chai nhựa');
    expect(screen.getByRole('button', { name: 'Sửa' })).toHaveFocus();
  });

  test('bấm ra chỗ khác thì tự lưu, con trỏ ở chỗ vừa bấm', async () => {
    const save = setup();
    await openAndType('Giấy');
    await userEvent.click(screen.getByRole('button', { name: 'Chỗ khác' }));
    expect(await screen.findByTestId('shown')).toHaveTextContent('Giấy');
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Chỗ khác' })).toHaveFocus();
  });

  test('Esc thì hủy, không lưu kể cả khi ô mất con trỏ sau đó', async () => {
    const save = setup();
    await openAndType('Sửa dở{Escape}');
    expect(screen.getByTestId('shown')).toHaveTextContent('Nhựa');
    await userEvent.click(screen.getByRole('button', { name: 'Chỗ khác' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sửa' })).not.toHaveFocus();
  });

  test('để trống hoặc không đổi thì đóng ô mà không lưu', async () => {
    const save = setup();
    await openAndType('   {Enter}');
    expect(screen.getByTestId('shown')).toHaveTextContent('Nhựa');
    await openAndType('Nhựa');
    await userEvent.tab();
    expect(screen.getByTestId('shown')).toHaveTextContent('Nhựa');
    expect(save).not.toHaveBeenCalled();
  });

  test('lưu lỗi thì ô vẫn mở với chữ đang gõ; sửa lại rồi lưu được', async () => {
    const save = setup(async (next) => next !== 'Giấy');
    const input = await openAndType('Giấy{Enter}');
    expect(await screen.findByRole('textbox', { name: 'Tên' })).toHaveValue('Giấy');
    expect(input).toHaveFocus();
    await userEvent.type(input, ' vụn{Enter}');
    expect(await screen.findByTestId('shown')).toHaveTextContent('Giấy vụn');
    expect(save).toHaveBeenCalledTimes(2);
  });

  test('Enter để chốt chữ của bộ gõ tiếng Việt thì không lưu', async () => {
    const save = setup();
    const input = await openAndType('Giấy');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(screen.getByRole('textbox', { name: 'Tên' })).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  test('đang lưu thì Esc không đóng ô', async () => {
    let finish: (ok: boolean) => void = () => {};
    const save = setup(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const input = await openAndType('Giấy{Enter}');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByRole('textbox', { name: 'Tên' })).toBeInTheDocument();
    await act(async () => finish(true));
    expect(await screen.findByTestId('shown')).toHaveTextContent('Giấy');
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('lưu ném lỗi thì ghi lại và giữ ô mở', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup(async () => {
      throw new Error('hỏng');
    });
    await openAndType('Kim loại{Enter}');
    expect(await screen.findByRole('textbox', { name: 'Tên' })).toHaveValue('Kim loại');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
