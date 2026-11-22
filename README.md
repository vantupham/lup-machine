# LUP Machine

**Phòng thí nghiệm AI minh bạch trên trình duyệt cho học sinh THCS và THPT.**

> Đừng chỉ xem AI đoán đúng. Hãy nhìn nó làm thế nào.

🌐 Dùng ngay: <https://vantupham.github.io/lup-machine/>

LUP Machine giúp học sinh tự huấn luyện mô hình học máy bằng dữ liệu của chính mình, rồi **mở nắp từng bước** để thấy AI đã làm gì: ảnh biến thành con số ra sao, máy học như thế nào, vì sao nó đoán sai. Dự án lấy cảm hứng từ ý tưởng của các công cụ học máy không cần lập trình và bổ sung những gì chúng còn thiếu cho lớp học.

## Ba cam kết

| | |
|---|---|
| 🔒 **Dữ liệu ở lại trên máy** | Không máy chủ, không tài khoản, không theo dõi. Mọi xử lý chạy trong trình duyệt. Xem [PRIVACY.md](PRIVACY.md). |
| 🔬 **Nói thật về AI** | Mỗi hình minh họa ghi rõ là *chính xác* hay *xấp xỉ*, kèm cách nó được tạo ra. |
| 🧩 **Mã nguồn mở, miễn phí** | Giáo viên có thể xem, góp ý và đóng góp bài học. |

## Trạng thái

**Phiên bản 0.1 – Giai đoạn nền móng.** Đã có:

- [x] Khung ứng dụng tiếng Việt / tiếng Anh, chế độ học *Khám phá* (THCS) và *Chuyên sâu* (THPT)
- [x] Xưởng mô hình: tạo, lưu, xóa dự án trên trình duyệt (IndexedDB)
- [x] Lõi dữ liệu: chia tập Dạy / Kiểm tra phân tầng có seed, trợ lý kiểm tra chất lượng dữ liệu
- [x] Định dạng tệp dự án `.lup` có kiểm tra schema
- [x] Trang Quyền riêng tư, nút xóa toàn bộ dữ liệu (cho máy dùng chung)
- [x] CI/CD: lint, kiểm tra kiểu, kiểm thử (độ phủ ≥ 80%), tự động triển khai lên GitHub Pages

Tiếp theo (Giai đoạn 1 – MVP): Studio Ảnh 6 bước với Kính hiển vi (xem điểm ảnh, vector đặc trưng, bản đồ PCA, giải thích bằng ví dụ, huấn luyện chậm có phát lại, ma trận nhầm lẫn bấm được). Xem [lộ trình đầy đủ](docs/ke-hoach/Phuong-an-xay-dung-website.md#10-lộ-trình-phát-triển).

## Yêu cầu

- **Người dùng:** Chrome hoặc Edge bản mới trên máy tính. Firefox và Safari dùng được phần lớn tính năng.
- **Nhà phát triển:** Node.js ≥ 20.17 (khuyến nghị 22, xem `.nvmrc`).

## Chạy trên máy

```bash
git clone https://github.com/vantupham/lup-machine.git
cd lup-machine
npm ci
npm run dev          # mở http://localhost:5173/lup-machine/
```

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy bản phát triển |
| `npm test` | Chạy kiểm thử |
| `npm run test:coverage` | Kiểm thử kèm báo cáo độ phủ |
| `npm run lint` | Kiểm tra quy chuẩn mã |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` | Build bản phát hành vào `dist/` |

## Cấu trúc

```
src/
├── app/        giao diện: khung trang, các trang
├── core/       lõi thuần TypeScript, không phụ thuộc React (thuật toán, dữ liệu, seed)
├── storage/    lưu trữ IndexedDB (Repository pattern), schema Zod cho tệp nhập
├── i18n/       bản dịch vi / en
└── ui/         thành phần và tiện ích giao diện dùng chung
docs/ke-hoach/  đánh giá, đề xuất và phương án xây dựng
```

## Tài liệu dự án

1. [Đánh giá Teachable Machine](docs/ke-hoach/Danh-gia-Teachable-Machine.md)
2. [Đề xuất nâng cấp cho giảng dạy AI](docs/ke-hoach/De-xuat-nang-cap-Teachable-Machine.md)
3. [Phương án xây dựng LUP Machine](docs/ke-hoach/Phuong-an-xay-dung-website.md)

## Đóng góp

Mọi đóng góp đều quý, đặc biệt từ giáo viên. Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## Giấy phép

- Mã nguồn: [MIT](LICENSE)
- Nội dung bài học và tài liệu: [CC BY 4.0](CONTENT_LICENSE.md)
