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

**Giai đoạn 1 – Studio Ảnh (đang làm).** Đã có:

- [x] Thu ảnh bằng tải tệp và webcam; mỗi lớp có ngăn Dạy / Kiểm tra; tự chia 80/20 có seed
- [x] Trợ lý kiểm tra dữ liệu hiển thị trực tiếp, có gợi ý sửa
- [x] Kính hiển vi điểm ảnh: giá trị RGB thật và giá trị sau chuẩn hóa mà mô hình nhận
- [x] Biểu diễn: trích đặc trưng MobileNetV2 (lưu đệm), xem 1.280 con số của mỗi ảnh, bản đồ dữ liệu 2D (PCA), ảnh Dạy giống nhất
- [x] Huấn luyện bình thường / chậm / từng bước, biểu đồ loss và độ chính xác, phát lại từng epoch
- [x] Đánh giá: điểm Dạy và Kiểm tra, cảnh báo quá khớp, ma trận nhầm lẫn bấm được, precision / recall
- [x] Nhật ký thí nghiệm: tự lưu mỗi lần huấn luyện, so sánh, chạy lại (tái lập bằng seed), tự khôi phục khi mở lại
- [x] 3 bộ dữ liệu mẫu tổng hợp (không ảnh người thật, không bản quyền), gồm bộ "bẫy nền" dạy hiện tượng học lối tắt
- [x] 3 bài học tương tác: Máy tính nhìn ảnh thế nào? · Dạy máy phân biệt hình · AI học nhầm điều gì? Xem [lộ trình đầy đủ](docs/ke-hoach/Phuong-an-xay-dung-website.md#10-lộ-trình-phát-triển).

**Giai đoạn 2 – Mở nắp sâu hơn (xong).** Đã có:

- [x] Bản đồ "mô hình nhìn vào đâu" (CAM / Grad-CAM) và đường đi phép tính từ đặc trưng đến xác suất
- [x] Ranh giới quyết định chính xác trên bản đồ 2D
- [x] Ngưỡng tin cậy
- [x] Bản đồ che khuất: che lần lượt 49 ô, đo xác suất giảm bao nhiêu (phép đo thật, đối chiếu được với CAM)
- [x] Bên trong mạng CNN (Chuyên sâu): kênh mạnh nhất của 5 tầng, từ 112×112 đến 7×7
- [x] Bản đồ UMAP (xấp xỉ, có seed) bên cạnh PCA (chính xác)
- [x] Chạy khi mất mạng: lần đầu mở có mạng, ứng dụng và mô hình được lưu sẵn trên máy
- [x] 2 bộ ảnh thật có giấy phép mở, tuyển chọn thủ công, ghi công từng ảnh: hoa (cúc / hướng dương / hồng) và lá đậu (khỏe / đốm góc / gỉ sắt)
- [x] Mô hình chạy trong Web Worker: giao diện luôn mượt, kể cả trên máy yếu (tự chuyển về luồng chính nếu trình duyệt không hỗ trợ)

## Yêu cầu

- **Người dùng:** Chrome hoặc Edge bản mới trên máy tính. Firefox và Safari dùng được phần lớn tính năng.
- **Nhà phát triển:** Node.js 22.22+, 24.15+ hoặc 26+ (CI dùng 26, xem `.nvmrc`).

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
- Bộ ảnh thật trong `public/datasets/`: giữ giấy phép gốc, ghi công từng ảnh (ảnh hoa: CC BY 2.0; ảnh lá đậu: MIT, © 2020 AIR Lab Makerere University). Xem [public/datasets/README.md](public/datasets/README.md)
- Mô hình MobileNetV2: Apache-2.0
