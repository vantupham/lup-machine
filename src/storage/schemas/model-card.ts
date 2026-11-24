import { z } from 'zod';

/**
 * Thẻ mô hình (Model Card): học sinh tự viết mô hình dùng để làm gì, dữ liệu từ đâu,
 * làm tốt đến đâu, khi nào dễ sai và không nên dùng để làm gì.
 */
export const MODEL_CARD_TEXT_FIELDS = ['purpose', 'data', 'performance', 'limitations', 'misuse'] as const;
export type ModelCardTextField = (typeof MODEL_CARD_TEXT_FIELDS)[number];

export const MODEL_CARD_AUTHORS_MAX_LENGTH = 100;
export const MODEL_CARD_TEXT_MAX_LENGTH = 1000;

const text = z.string().trim().max(MODEL_CARD_TEXT_MAX_LENGTH);

const modelCardShape = {
  authors: z.string().trim().max(MODEL_CARD_AUTHORS_MAX_LENGTH),
  purpose: text,
  data: text,
  performance: text,
  limitations: text,
  misuse: text,
};

/** Khi lưu: chỉ nhận đúng các trường đã biết. */
export const modelCardFieldsSchema = z.object(modelCardShape).strict();

/** Khi đọc tệp / dữ liệu cũ: bỏ qua trường lạ, để bản ứng dụng cũ vẫn mở được thẻ do bản mới hơn tạo. */
export const modelCardFileSchema = z.object(modelCardShape);

export type ModelCardFields = z.infer<typeof modelCardFieldsSchema>;

export const EMPTY_MODEL_CARD: ModelCardFields = { authors: '', purpose: '', data: '', performance: '', limitations: '', misuse: '' };

/** Thẻ đủ khi cả 5 câu hỏi đều có câu trả lời (tên người làm không bắt buộc). */
export function isModelCardComplete(card: ModelCardFields | null): boolean {
  return card !== null && MODEL_CARD_TEXT_FIELDS.every((field) => card[field].trim() !== '');
}

export function missingModelCardFields(card: ModelCardFields | null): ModelCardTextField[] {
  return MODEL_CARD_TEXT_FIELDS.filter((field) => !card || card[field].trim() === '');
}

/** Chỉ lấy các trường của thẻ (bỏ projectId, updatedAt…). */
export function pickModelCardFields(card: ModelCardFields): ModelCardFields {
  const { authors, purpose, data, performance, limitations, misuse } = card;
  return { authors, purpose, data, performance, limitations, misuse };
}

export function parseModelCardFields(input: unknown): ModelCardFields | null {
  const result = modelCardFileSchema.safeParse(input);
  return result.success ? result.data : null;
}
