/**
 * Chạy vitest với chữ ổ đĩa viết hoa (Windows).
 *
 * Git Bash (và terminal VS Code dùng Git Bash) đưa cho Node thư mục làm việc dạng "c:\…". Khi đó
 * runner của vitest và các file test nạp hai bản module "vitest" khác nhau (một theo "c:\", một theo
 * "C:\"), nên matcher của jest-dom gắn vào bản kia và test component báo
 * "Invalid Chai property: toBeInTheDocument". Đặt test.root hay --root không đủ: cả thư mục làm việc
 * lẫn đường dẫn tới CLI của vitest đều phải viết hoa trước khi vitest khởi động.
 * Trên Linux/macOS (CI) script chỉ chuyển tiếp tham số.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const upperDrive = (path) => path.replace(/^[a-z]:/, (drive) => drive.toUpperCase());

const require = createRequire(import.meta.url);
const vitestCli = upperDrive(join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'));

const result = spawnSync(process.execPath, [vitestCli, ...process.argv.slice(2)], {
  cwd: upperDrive(process.cwd()),
  stdio: 'inherit',
});
if (result.error) {
  console.error(`Không chạy được vitest: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
