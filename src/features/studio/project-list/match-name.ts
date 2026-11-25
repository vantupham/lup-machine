/** Bỏ dấu tiếng Việt và chữ hoa để học sinh gõ "rac" vẫn tìm ra "Phân loại rác". */
export function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .trim();
}

export function matchesName(name: string, query: string): boolean {
  const needle = foldVietnamese(query);
  return needle === '' || foldVietnamese(name).includes(needle);
}
