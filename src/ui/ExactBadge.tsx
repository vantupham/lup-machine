interface ExactBadgeProps {
  readonly label: string;
  readonly hint: string;
  readonly kind?: 'exact' | 'approximate';
}

/**
 * Nhãn độ tin cậy của một hình minh họa: 🟩 chính xác (đúng phép tính của mô hình)
 * hoặc 🟨 xấp xỉ (minh họa gần đúng). Bắt buộc có trên mọi công cụ của Kính hiển vi.
 */
export function ExactBadge({ label, hint, kind = 'exact' }: ExactBadgeProps) {
  const color = kind === 'exact' ? 'var(--color-accent)' : 'var(--color-warning)';
  return (
    <span
      title={hint}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{ borderColor: color, color }}
    >
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
      <span className="sr-only">: {hint}</span>
    </span>
  );
}
