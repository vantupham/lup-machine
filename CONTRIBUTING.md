# Hướng dẫn đóng góp

Cảm ơn bạn quan tâm tới LUP Machine! Dự án chào đón cả **giáo viên** (góp ý nội dung, bài học) và **nhà phát triển** (mã nguồn).

## Giáo viên: không cần biết lập trình

- **Báo lỗi kiến thức** hoặc giải thích khó hiểu: dùng mẫu *Báo lỗi nội dung* trong [Issues](https://github.com/vantupham/lup-machine/issues/new/choose).
- **Đề xuất bài học / hoạt động:** dùng mẫu *Đề xuất*.
- **Chia sẻ kinh nghiệm dùng trên lớp:** rất quý cho việc cải tiến.

## Nhà phát triển

### Quy trình

1. Fork repo, tạo nhánh từ `main`: `feat/ten-tinh-nang` hoặc `fix/mo-ta-loi`.
2. **Viết kiểm thử trước (TDD)**, rồi mới viết mã cho kiểm thử chạy qua.
3. Chạy đủ trước khi gửi:
   ```bash
   npm run lint && npm run typecheck && npm run test:coverage && npm run build
   ```
4. Commit theo [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `perf:`, `ci:`.
5. Mở Pull Request, mô tả thay đổi và cách kiểm thử.

### Nguyên tắc mã nguồn

- **TypeScript strict**, không dùng `any`; dữ liệu từ ngoài (tệp nhập) phải qua schema Zod.
- **Bất biến:** tạo đối tượng mới thay vì sửa đối tượng cũ.
- **`src/core/` không phụ thuộc React**, để kiểm thử độc lập và dùng được trong Web Worker.
- Hàm < 50 dòng, tệp < 400 dòng (tối đa 800).
- Không `console.log`; không `dangerouslySetInnerHTML`; không tải mã từ CDN bên ngoài.
- Mọi chuỗi giao diện đặt trong `src/i18n/vi.json` và `en.json`.
- Độ phủ kiểm thử ≥ 80% (CI sẽ chặn nếu thấp hơn).

### Nguyên tắc về độ tin cậy khoa học

- Thuật toán tự cài đặt phải có kiểm thử **đối chiếu kết quả tham chiếu** (scikit-learn / NumPy).
- Mọi hình minh họa trong Kính hiển vi phải ghi rõ **chính xác** hay **xấp xỉ**, và có phần "Hình này được tạo thế nào?".
- Dùng ngôn ngữ chính xác: "mô hình tính ra xác suất…", không viết "AI hiểu rằng…".

### Quyền riêng tư

- Không thêm bất kỳ công cụ theo dõi, phân tích hay dịch vụ bên ngoài nào.
- Không đưa ảnh khuôn mặt người thật vào dữ liệu mẫu hoặc kiểm thử.

## Quy tắc ứng xử

Tôn trọng, kiên nhẫn và thân thiện, đặc biệt với người mới và học sinh. Xem [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
