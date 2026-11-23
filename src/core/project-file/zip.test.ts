import { zipSync } from 'fflate';
import { readZip, writeZip, ZipLimitError, type ZipLimits } from './zip';

const text = (s: string) => new TextEncoder().encode(s);
const limits: ZipLimits = { maxArchiveBytes: 10_000, maxEntries: 3, maxTotalBytes: 3_000 };
const acceptAll = () => 2_000;

describe('writeZip / readZip', () => {
  test('ghi rồi đọc lại đúng nội dung từng tệp', () => {
    const archive = writeZip({ 'a.json': text('{"x":1}'), 'samples/0001.jpg': new Uint8Array([255, 216, 255, 1]) });
    const files = readZip(archive, limits, acceptAll);
    expect(new TextDecoder().decode(files.get('a.json'))).toBe('{"x":1}');
    expect(Array.from(files.get('samples/0001.jpg') ?? [])).toEqual([255, 216, 255, 1]);
  });

  test('chỉ giải nén những tệp có tên được chấp nhận, bỏ qua thư mục', () => {
    const archive = zipSync({ 'a.json': text('1'), 'la.exe': text('MZ'), 'samples/': new Uint8Array(0) });
    const files = readZip(archive, limits, (name) => (name.endsWith('.json') ? 100 : false));
    expect([...files.keys()]).toEqual(['a.json']);
  });

  test('từ chối tệp quá lớn trước khi giải nén', () => {
    const archive = writeZip({ 'a.json': text('1') });
    expect(() => readZip(archive, { ...limits, maxArchiveBytes: 10 }, acceptAll)).toThrow(ZipLimitError);
  });

  test('từ chối quá nhiều tệp', () => {
    const archive = zipSync({ '1.json': text('1'), '2.json': text('2'), '3.json': text('3'), '4.json': text('4') });
    expect(() => readZip(archive, limits, acceptAll)).toThrow(/quá nhiều tệp/);
  });

  test('chặn "bom zip": một tệp nén nhỏ nhưng giải nén ra rất lớn', () => {
    const archive = zipSync({ 'bomb.json': new Uint8Array(1_000_000) }, { level: 9 });
    expect(archive.length).toBeLessThan(limits.maxArchiveBytes);
    expect(() => readZip(archive, limits, acceptAll)).toThrow(/quá lớn/);
  });

  test('giới hạn riêng cho từng loại tệp', () => {
    const archive = zipSync({ 'a.wav': new Uint8Array(200) });
    expect(() => readZip(archive, limits, () => 100)).toThrow(/quá lớn/);
  });

  test('chặn tổng dung lượng giải nén vượt giới hạn', () => {
    const archive = zipSync({ 'a.json': new Uint8Array(1_500), 'b.json': new Uint8Array(1_600) });
    expect(() => readZip(archive, limits, acceptAll)).toThrow(/quá lớn/);
  });

  test('kích thước khai báo nhỏ hơn thực tế thì không thể tràn bộ nhớ', () => {
    const archive = zipSync({ 'a.json': new Uint8Array(1_500).fill(65) }, { level: 6 });
    // sửa kích thước gốc khai báo (ở cả tiêu đề cục bộ và thư mục trung tâm) thành 10 byte
    const view = new DataView(archive.buffer);
    for (let i = 0; i + 4 <= archive.length; i++) {
      const sig = view.getUint32(i, true);
      if (sig === 0x04034b50) view.setUint32(i + 22, 10, true);
      if (sig === 0x02014b50) view.setUint32(i + 24, 10, true);
    }
    // hoặc báo lỗi, hoặc chỉ ra tối đa 10 byte — không bao giờ cấp phát theo kích thước thật
    const read = () => readZip(archive, limits, acceptAll).get('a.json')?.length ?? 0;
    let size = 0;
    try {
      size = read();
    } catch {
      // tệp bị coi là hỏng: chấp nhận được
    }
    expect(size).toBeLessThanOrEqual(10);
  });

  test('tệp hỏng thì báo lỗi rõ ràng', () => {
    expect(() => readZip(text('không phải zip'), limits, acceptAll)).toThrow(/không đọc được/i);
  });
});
