# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm (Giai đoạn 1 – Studio Ảnh, phần 1)

- Trang dự án ảnh: thêm / đổi tên / xóa lớp; mỗi lớp có hai ngăn Dạy và Kiểm tra.
- Thu ảnh bằng tải tệp (kiểm tra định dạng, dung lượng, số lượng) và webcam (chụp 1 ảnh hoặc giữ để chụp liên tục, camera tắt ngay khi đóng).
- Ảnh được cắt vuông giữa và thu về 224×224 ngay khi thu thập; ảnh lưu chính là ảnh mô hình nhận.
- Tự chia Dạy / Kiểm tra 80/20 theo từng lớp với seed cố định (tái lập được).
- Trợ lý kiểm tra dữ liệu: thiếu lớp, lớp rỗng, ít ảnh, mất cân bằng, thiếu ảnh Kiểm tra; biểu đồ số ảnh mỗi lớp; gợi ý cách sửa ở chế độ Khám phá.
- Kính hiển vi điểm ảnh: chọn điểm bằng chuột hoặc phím mũi tên, xem giá trị RGB thật, lưới 7×7 xung quanh, giá trị sau chuẩn hóa [−1, 1] ở chế độ Chuyên sâu; nhãn "Chính xác" và phần "Hình này được tạo thế nào?".
- Mô hình nền MobileNetV2 α=0,35 tự lưu trữ trong public/models (chuẩn bị cho bước Biểu diễn).
- Xóa dự án / xóa toàn bộ dữ liệu nay xóa luôn lớp và ảnh liên quan.
- Kiểm thử E2E bằng Playwright trên bản build thật có CSP, camera giả; chạy trong CI.

## [0.1.0] – 2026-11-22

Giai đoạn 0 – Nền móng.

### Thêm

- Khung ứng dụng React + TypeScript + Vite, định tuyến bằng hash cho GitHub Pages.
- Giao diện tiếng Việt / tiếng Anh; chế độ học *Khám phá* (THCS) và *Chuyên sâu* (THPT).
- Trang chủ, Xưởng mô hình (tạo / xóa dự án), Giới thiệu & Quyền riêng tư (xóa toàn bộ dữ liệu).
- Lưu trữ IndexedDB theo Repository pattern; schema Zod cho dự án và manifest tệp `.lup`.
- Lõi dữ liệu: bộ sinh số ngẫu nhiên có seed, chia Dạy / Kiểm tra phân tầng, kiểm tra chất lượng dữ liệu.
- Chính sách bảo mật nội dung (CSP) qua thẻ meta khi build.
- CI (lint, typecheck, kiểm thử độ phủ ≥ 80%, build, audit) và tự động triển khai lên GitHub Pages.
