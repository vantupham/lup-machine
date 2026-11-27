import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react';

/** Trạng thái ô sửa: đóng, đang gõ, hay đang chờ lưu (để Enter rồi rời ô không lưu hai lần). */
type EditPhase = 'closed' | 'editing' | 'saving';

interface InlineEditOptions {
  /** Tên đang hiển thị (đã lưu). */
  readonly value: string;
  /** Lưu tên mới (đã cắt khoảng trắng, khác tên cũ). Trả về false để giữ ô sửa mở (vd. trùng tên). */
  readonly onSave: (next: string) => Promise<boolean>;
}

export interface InlineEditInputProps {
  readonly value: string;
  readonly onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  readonly onBlur: () => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export interface InlineEdit {
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  /** Mở ô sửa với tên hiện tại (gắn vào nút bút chì). */
  readonly start: () => void;
  /** Gắn vào nút bút chì để trả con trỏ về đó sau khi sửa xong bằng bàn phím. */
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  /** Gắn vào ô nhập (để tự đặt con trỏ khi mở và khi lưu lỗi). */
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly inputProps: InlineEditInputProps;
}

/**
 * Sửa tên ngay tại chỗ, tự lưu: Enter hoặc rời ô là lưu, Esc là hủy.
 * Để trống hoặc không đổi thì đóng ô mà không ghi gì; lưu lỗi thì ô vẫn mở để sửa tiếp.
 */
export function useInlineEdit({ value, onSave }: InlineEditOptions): InlineEdit {
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const phase = useRef<EditPhase>('closed');
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Chỉ trả con trỏ về bút chì khi người dùng đóng ô bằng bàn phím; bấm ra chỗ khác thì để con trỏ ở đó. */
  const returnFocus = useRef(false);
  const isEditing = draft !== null;

  // Layout effect: chuyển con trỏ trước khi vẽ để không rơi về <body>.
  useLayoutEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [isEditing]);

  const close = (byKeyboard: boolean) => {
    phase.current = 'closed';
    returnFocus.current = byKeyboard;
    setDraft(null);
  };

  const commit = async (byKeyboard: boolean) => {
    if (phase.current !== 'editing' || draft === null) return;
    const next = draft.trim();
    if (!next || next === value) {
      close(byKeyboard);
      return;
    }
    phase.current = 'saving';
    setIsSaving(true);
    try {
      if (await onSave(next)) {
        close(byKeyboard);
        return;
      }
      phase.current = 'editing';
      if (byKeyboard) inputRef.current?.focus();
    } catch (error: unknown) {
      // onSave nên tự bắt lỗi và trả về false; lỗi lọt ra đây thì ghi lại và giữ ô mở để sửa tiếp.
      console.error('Không lưu được tên', error);
      phase.current = 'editing';
    } finally {
      setIsSaving(false);
    }
  };

  const start = () => {
    phase.current = 'editing';
    setDraft(value);
  };

  return {
    isEditing,
    isSaving,
    start,
    triggerRef,
    inputRef,
    inputProps: {
      value: draft ?? '',
      onChange: (e) => setDraft(e.target.value),
      onBlur: () => void commit(false),
      onKeyDown: (e) => {
        // Bộ gõ tiếng Việt (Telex/VNI) dùng Enter/Esc để chốt chữ đang ghép: không coi là lưu/hủy.
        if (e.nativeEvent.isComposing) return;
        // Đang lưu thì Esc không "hủy" được nữa (tên có thể đã ghi), để kết quả lưu quyết định.
        if (phase.current === 'saving') return;
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close(true);
        }
      },
    },
  };
}
