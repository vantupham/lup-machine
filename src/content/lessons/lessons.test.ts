import { SAMPLE_DATASETS } from '@/core/datasets/synthetic';
import { findLesson, LESSONS } from './index';

describe('Nội dung bài học', () => {
  test('id không trùng và là slug hợp lệ', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  test.each(LESSONS.map((l) => [l.title, l] as const))('%s: cấu trúc đầy đủ và hợp lệ', (_title, lesson) => {
    expect(SAMPLE_DATASETS.some((d) => d.id === lesson.dataset)).toBe(true);
    expect(lesson.goals.length).toBeGreaterThan(0);
    expect(lesson.steps.length).toBeGreaterThan(0);
    expect(lesson.quiz.length).toBeGreaterThanOrEqual(2);
    expect(lesson.minutes).toBeGreaterThan(0);
    for (const q of lesson.quiz) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  test('tìm bài học theo id', () => {
    expect(findLesson('ai-hoc-nham')?.dataset).toBe('background-trap');
    expect(findLesson('khong-co')).toBeUndefined();
  });

  test('con số trong bài 1 khớp với kích thước ảnh mô hình nhận', () => {
    expect(224 * 224 * 3).toBe(150528);
    expect(JSON.stringify(findLesson('may-tinh-nhin-anh'))).toContain('150.528');
  });
});
