import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_FILE_BYTES, planUpload, validateImageFile } from './image-file';

describe('validateImageFile', () => {
  test('nhận ảnh JPEG hợp lệ', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
  });
  test.each([
    [{ type: 'image/svg+xml', size: 10 }, 'unsupported-type'],
    [{ type: 'application/pdf', size: 10 }, 'unsupported-type'],
    [{ type: 'image/png', size: 0 }, 'empty'],
    [{ type: 'image/png', size: MAX_IMAGE_FILE_BYTES + 1 }, 'too-large'],
  ] as const)('từ chối %o → %s', (file, reason) => {
    expect(validateImageFile(file)).toBe(reason);
  });
});

describe('planUpload', () => {
  test('tách tệp hợp lệ và không hợp lệ', () => {
    const good = { type: 'image/png', size: 5 };
    const bad = { type: 'text/plain', size: 5 };
    const plan = planUpload([good, bad]);
    expect(plan.accepted).toEqual([good]);
    expect(plan.rejected).toEqual([{ file: bad, reason: 'unsupported-type' }]);
  });

  test('giới hạn số tệp mỗi lần tải', () => {
    const files = Array.from({ length: MAX_FILES_PER_UPLOAD + 2 }, () => ({ type: 'image/png', size: 5 }));
    const plan = planUpload(files);
    expect(plan.accepted).toHaveLength(MAX_FILES_PER_UPLOAD);
    expect(plan.rejected.every((r) => r.reason === 'too-many')).toBe(true);
  });
});
