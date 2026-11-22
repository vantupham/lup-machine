/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages phục vụ trang tại https://vantupham.github.io/lup-machine/
const BASE_PATH = '/lup-machine/';

/**
 * Chính sách bảo mật nội dung (CSP). GitHub Pages không cho đặt HTTP header,
 * nên CSP được chèn bằng thẻ <meta> — chỉ khi build (bản dev của Vite cần script nội tuyến).
 * Không cho phép tải mã từ nguồn bên ngoài.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'lup-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss(), cspPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Chunk lớn nhất là backend WebGL của TensorFlow.js (~530 kB, ~84 kB gzip), chỉ tải khi trích đặc trưng.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Tách thư viện ít thay đổi thành chunk riêng để trình duyệt cache lâu dài.
        // TensorFlow.js không nằm trong nhóm nào → vẫn được tải động khi cần.
        codeSplitting: {
          groups: [
            // [\\/] khớp cả dấu / và \ (đường dẫn Windows).
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](dexie|zod|zustand)[\\/]/ },
            { name: 'i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // *.browser.ts dùng canvas / WebGL / camera thật, không chạy được trong jsdom:
      // chúng được kiểm chứng bằng E2E trên Chromium (tests/e2e), không tính vào độ phủ kiểm thử đơn vị.
      exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts', 'src/**/*.browser.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
