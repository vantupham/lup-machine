import { nextProjectName, projectTypeFromSlug, slugForProjectType, QUICK_START_TYPES } from './quick-start';

describe('nextProjectName', () => {
  test('dự án đầu tiên được đánh số 1', () => {
    expect(nextProjectName('Dự án ảnh', [])).toBe('Dự án ảnh 1');
  });

  test('lấy số lớn nhất đã dùng rồi cộng 1, không dùng lại số đã xóa', () => {
    expect(nextProjectName('Dự án ảnh', ['Dự án ảnh 1', 'Dự án ảnh 3'])).toBe('Dự án ảnh 4');
  });

  test('bỏ qua tên của loại khác và tên tự đặt', () => {
    expect(nextProjectName('Dự án ảnh', ['Dự án âm thanh 7', 'Phân loại rác', 'Dự án ảnh 2b', 'Dự án ảnh 2'])).toBe('Dự án ảnh 3');
  });

  test('không bị đánh lừa bởi ký tự đặc biệt của biểu thức chính quy trong tên gốc', () => {
    expect(nextProjectName('Dự án (A+)', ['Dự án (A+) 5', 'Dự án AAA 9'])).toBe('Dự án (A+) 6');
  });
});

describe('đường dẫn tạo nhanh', () => {
  test('mọi loại dự án đều có đường dẫn và đọc ngược được', () => {
    for (const type of QUICK_START_TYPES) expect(projectTypeFromSlug(slugForProjectType(type))).toBe(type);
  });

  test('đường dẫn tiếng Việt không dấu, dễ đọc cho giáo viên', () => {
    expect(QUICK_START_TYPES.map(slugForProjectType)).toEqual(['anh', 'am-thanh', 'tu-the', 'van-ban', 'bang-so']);
  });

  test('đường dẫn lạ thì trả về null', () => {
    expect(projectTypeFromSlug('video')).toBeNull();
    expect(projectTypeFromSlug('')).toBeNull();
    expect(projectTypeFromSlug('toString')).toBeNull();
  });
});
