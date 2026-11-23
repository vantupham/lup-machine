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
- [x] 4 bài học tương tác: Máy tính nhìn ảnh thế nào? · Dạy máy phân biệt hình · AI học nhầm điều gì? · AI làm bác sĩ cây trồng; mỗi bài có phiếu bài tập in được (bản học sinh và bản giáo viên có đáp án) Xem [lộ trình đầy đủ](docs/ke-hoach/Phuong-an-xay-dung-website.md#10-lộ-trình-phát-triển).

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

**Giai đoạn 3 – Sân chơi thuật toán & dữ liệu bảng (xong).** Đã có:

- [x] Sân chơi thuật toán (`#/playground`) với 6 thuật toán tự cài đặt bằng TypeScript, chạy từng bước trên dữ liệu 2D: k-NN, cây quyết định (mọc từng nút, thấy quá khớp), hồi quy tuyến tính (tự kéo đường thẳng), gradient descent, k-means, mạng nơ-ron mini (xem từng nơ-ron "vẽ" gì)
- [x] Kiểm thử đối chiếu với scikit-learn (`scripts/gen-reference-results.py`): k-NN (phân loại và hồi quy), cây quyết định, hồi quy tuyến tính, hồi quy logistic, k-means, một bước huấn luyện của mạng nơ-ron
- [x] Studio dữ liệu bảng: nạp CSV (tải tệp, dán từ Excel / Google Trang tính, hoặc bộ mẫu Iris và chim cánh cụt Palmer), chọn cột nhãn và đặc trưng, trợ lý kiểm tra dữ liệu (dòng thiếu, mất cân bằng, cột giống mã định danh), xem chuẩn hóa và one-hot, huấn luyện cây quyết định / hồi quy logistic / k-NN / hồi quy tuyến tính, ma trận nhầm lẫn, R², giải thích từng dự đoán
- [x] Xuất notebook Google Colab (tạo ngay trong trình duyệt, tải về máy): dự án bảng dựng lại đúng mô hình bằng scikit-learn và so kết quả với LUP Machine; dự án ảnh huấn luyện lại tầng phân loại bằng Keras rồi chuyển mô hình hoàn chỉnh sang TensorFlow Lite. `scripts/check-notebooks.py` chạy thật các notebook mẫu

**Giai đoạn 4 – Âm thanh, tư thế, văn bản tiếng Việt (xong).** Đã có:

- [x] Studio văn bản tiếng Việt: tự gõ câu cho từng nhóm, tải CSV, hoặc 2 bộ câu mẫu tự soạn (chủ đề; góp ý căng tin); trợ lý kiểm tra (câu trùng, câu mâu thuẫn nhãn, câu quá ngắn, mất cân bằng); Kính hiển vi tách âm tiết và TF-IDF; Naive Bayes và hồi quy logistic; từ đặc trưng của mỗi nhóm; tô màu đóng góp của từng âm tiết trong câu (cộng lại đúng bằng điểm của mô hình); xuất notebook Colab. Đối chiếu scikit-learn: TF-IDF, Naive Bayes, hồi quy logistic
- [x] Studio âm thanh: thu 1 giây bằng micro (có phổ trực tiếp), tải tệp, hoặc âm thanh mẫu tổng hợp (chuông / còi / trống); trợ lý báo đoạn im lặng, đoạn bị rè; Kính hiển vi dạng sóng → FFT một khung → ảnh phổ mel → 160 con số; hồi quy logistic (bản đồ vùng phổ quan trọng, đóng góp từng ô) hoặc k-NN (nghe lại các đoạn giống nhất); xuất notebook Colab. Đối chiếu NumPy / librosa: FFT, cửa sổ Hann, bộ lọc mel, ảnh phổ mel
- [x] Studio tư thế & bàn tay: MoveNet (17 khớp) và MediaPipe Hand Landmark (21 điểm) tự lưu trữ, chạy trên trình duyệt; ghi từ camera (1 mẫu hoặc 10 mẫu liên tiếp có đếm ngược), tải ảnh, hoặc tư thế / cử chỉ mẫu giả lập; **chỉ lưu tọa độ khớp, không lưu ảnh**; Kính hiển vi chuẩn hóa (gốc ở hông / cổ tay, đơn vị = thân / bàn tay); độ quan trọng từng khớp; nhận dạng trực tiếp qua camera, khung xương tô màu theo đóng góp; xuất notebook Colab

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
- Bộ dữ liệu bảng trong `src/content/tabular/`: Iris (CC BY 4.0), chim cánh cụt Palmer (CC0 1.0). Xem [src/content/tabular/README.md](src/content/tabular/README.md)
- Mô hình MobileNetV2: Apache-2.0
