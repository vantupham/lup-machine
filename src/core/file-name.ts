/** Phần tên tệp an toàn từ tên dự án: bỏ dấu tiếng Việt, thay ký tự lạ bằng "-", tối đa 60 ký tự. */
export function fileSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'du-an';
}
