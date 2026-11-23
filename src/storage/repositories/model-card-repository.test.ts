import { LupDatabase } from '../db';
import { createDexieModelCardRepository, type ModelCardRepository } from './model-card-repository';
import { createDexieProjectRepository } from './project-repository';
import { EMPTY_MODEL_CARD, isModelCardComplete, missingModelCardFields } from '../schemas/model-card';

let db: LupDatabase;
let cards: ModelCardRepository;

const filled = {
  authors: '  Nhóm 3 – 7A ',
  purpose: 'Phân loại rác',
  data: 'Ảnh tự chụp ở lớp, có xin phép',
  performance: 'Đúng 18/20 ảnh kiểm tra',
  limitations: 'Ảnh tối thì hay nhầm',
  misuse: 'Không dùng để chấm điểm bạn',
};

beforeEach(() => {
  db = new LupDatabase(`test-${crypto.randomUUID()}`);
  cards = createDexieModelCardRepository(db, () => '2026-11-23T10:00:00.000Z');
});

afterEach(async () => {
  await db.delete();
});

describe('ModelCardRepository', () => {
  test('chưa có thẻ thì trả về null', async () => {
    expect(await cards.get('p1')).toBeNull();
  });

  test('lưu rồi đọc lại, cắt khoảng trắng hai đầu', async () => {
    const saved = await cards.save('p1', filled);
    expect(saved).toEqual({ ...filled, authors: 'Nhóm 3 – 7A', projectId: 'p1', updatedAt: '2026-11-23T10:00:00.000Z' });
    expect(await cards.get('p1')).toEqual(saved);
  });

  test('từ chối câu trả lời quá dài hoặc trường lạ', async () => {
    await expect(cards.save('p1', { ...filled, purpose: 'x'.repeat(1001) })).rejects.toThrow();
    await expect(cards.save('p1', { ...filled, extra: 1 } as never)).rejects.toThrow();
  });

  test('thẻ do bản mới hơn tạo (có trường lạ) vẫn đọc được, trường lạ bị bỏ', async () => {
    await db.modelCards.put({ projectId: 'p1', fields: { ...filled, newField: 'x' }, updatedAt: '2026-11-23T10:00:00.000Z' });
    const card = await cards.get('p1');
    expect(card?.purpose).toBe('Phân loại rác');
    expect(card).not.toHaveProperty('newField');
  });

  test('dữ liệu hỏng thì coi như chưa có thẻ', async () => {
    await db.modelCards.put({ projectId: 'p1', fields: { purpose: 42 }, updatedAt: '2026-11-23T10:00:00.000Z' });
    expect(await cards.get('p1')).toBeNull();
  });

  test('xóa dự án thì xóa luôn thẻ mô hình', async () => {
    const projects = createDexieProjectRepository(db);
    const project = await projects.create({ name: 'A', projectType: 'image' });
    await cards.save(project.id, filled);
    await projects.delete(project.id);
    expect(await cards.get(project.id)).toBeNull();
    await cards.save('p2', filled);
    await projects.deleteAll();
    expect(await cards.get('p2')).toBeNull();
  });
});

describe('thẻ mô hình đã đủ chưa', () => {
  test('đủ khi cả 5 câu hỏi có câu trả lời; tên người làm không bắt buộc', () => {
    expect(isModelCardComplete({ ...filled, authors: '' })).toBe(true);
    expect(isModelCardComplete(null)).toBe(false);
    expect(isModelCardComplete({ ...filled, misuse: '   ' })).toBe(false);
  });

  test('liệt kê câu còn thiếu theo thứ tự', () => {
    expect(missingModelCardFields(null)).toEqual(['purpose', 'data', 'performance', 'limitations', 'misuse']);
    expect(missingModelCardFields({ ...EMPTY_MODEL_CARD, purpose: 'a', limitations: 'b' })).toEqual(['data', 'performance', 'misuse']);
  });
});
