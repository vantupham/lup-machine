# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm (phiếu bài tập in được)

- Mỗi bài học có "Phiếu bài tập in được" (`#/lessons/<id>/phieu-bai-tap`), sinh tự động từ nội dung bài nên luôn khớp với bài: ô họ tên / lớp / ngày, mỗi câu dự đoán có chỗ ghi "Em dự đoán (viết TRƯỚC khi làm)" và "Kết quả em quan sát được", câu hỏi trắc nghiệm có ô đánh dấu, phần tự rút ra bài học.
- Bài có thể khai báo khung ghi kết quả riêng cho từng bước (ô điền, bảng, ma trận nhầm lẫn trống có tên lớp, dòng kẻ). Bài 4 có bảng điểm theo epoch, ma trận nhầm lẫn 3×3, bảng ngưỡng tin cậy.
- "Bản giáo viên (có đáp án)": đáp án câu dự đoán, đáp án đúng và giải thích của câu hỏi, tổng kết, ghi chú có số liệu đã kiểm chứng.
- Bản giáo viên điền sẵn số liệu mẫu từ lần chạy kiểm chứng vào các bảng (bài 4: điểm theo epoch, ma trận nhầm lẫn, ngưỡng tin cậy) và gợi ý đáp án cho câu hỏi mở. Số liệu được kiểm thử đơn vị kiểm tra tính nhất quán (mỗi hàng ma trận đủ 6 ảnh, đường chéo khớp điểm Kiểm tra, ngưỡng 50% trả lời đủ 18 ảnh…) và E2E đối chiếu với lần chạy MobileNet thật (mỗi ô lệch tối đa 1 ảnh).
- Bản in khổ A4, luôn nền trắng chữ đen kể cả khi máy đang ở chế độ tối, ẩn thanh điều hướng; in được khi mất mạng hoặc lưu thành PDF. Kiểm chứng bằng E2E xuất PDF thật (bài 4: 4 trang mỗi bản).

### Thêm (bài học 4)

- Bài "AI làm bác sĩ cây trồng" (lớp 8–12, 45 phút) dùng bộ ảnh lá đậu thật: dữ liệu thật khó hơn hình vẽ, quá khớp (học lâu hơn không giúp), lỗi nào nguy hiểm nhất với nông dân (ma trận nhầm lẫn, recall), mô hình nhìn vào đâu, ngưỡng tin cậy để AI biết nói "không chắc", và cách cải thiện dữ liệu.
- Mọi khẳng định của bài được kiểm chứng bằng E2E với MobileNet thật đi đúng đường học sinh đi: Dạy 100% / Kiểm tra 72,2%, lỗi hay gặp nhất là gỉ sắt → đốm góc, không có lá bệnh bị đoán là khỏe, ngưỡng 90% trả lời 10/18 ảnh với 90% đúng.
- Bài học nay có thể dùng cả bộ hình vẽ tổng hợp lẫn bộ ảnh thật.

### Thêm (bộ ảnh thật có giấy phép mở)

- "Hoa cúc, hướng dương hay hoa hồng?": 90 ảnh Flickr (CC BY 2.0), tuyển từ tf_flowers.
- "Bác sĩ lá đậu": 90 ảnh lá đậu chụp ngoài đồng ở Uganda (bộ ibean, MIT, AIR Lab Makerere).
- Mỗi ảnh mang ghi công (tác giả, nguồn, giấy phép), hiển thị trong Kính hiển vi, khi bấm ảnh trên bản đồ và trong danh sách "Ghi công từng ảnh" trên thẻ.
- Tuyển chọn tất định bằng seed; mọi ảnh đều được duyệt bằng mắt, ảnh có người, chữ, logo hoặc sai lớp bị loại (ghi trong `scripts/photo-datasets.json`); script `scripts/build-photo-datasets.py` dựng lại được.
- Manifest được kiểm tra bằng zod: chỉ chấp nhận đường dẫn `lớp/NN.jpg`, liên kết https, đủ ghi công; tải hết ảnh trước khi tạo dự án nên lỗi mạng không để lại dự án dở dang.
- Kiểm chứng bằng MobileNet thật (E2E): hoa đạt 88,9% điểm Kiểm tra, lá đậu 72,2% (khó hơn, đúng như mô tả trên thẻ).
- Service worker không lưu sẵn bộ ảnh (tránh bắt mọi người tải thêm ~2,8 MB); ảnh được lưu khi dùng lần đầu, sau đó mất mạng vẫn tạo lại được dự án.

### Sửa

- Nút "Đo bằng cách che từng ô" và "Mở các tầng của mạng" thiếu kiểu nút.


### Thay đổi (hiệu năng)

- MobileNet chạy trong Web Worker: giao diện không còn đứng hình khi trích đặc trưng, đo che khuất hay mở các tầng CNN. Đo bằng E2E trên Chromium: khoảng đứng hình dài nhất giảm từ ~2 000 ms xuống ~60 ms.
- Ảnh được sao chép sang worker, kết quả được chuyển giao về (không tốn bản sao). Worker dùng WebGL qua OffscreenCanvas, không có thì CPU.
- Tự chuyển sang chạy ở luồng chính nếu trình duyệt không tạo được module worker hoặc mô hình không khởi động được trong worker; worker bị sập thì lần gọi sau tạo lại.
- Giao thức tin nhắn (`src/core/ml/worker-protocol.ts`) tách khỏi TensorFlow.js và có kiểm thử đơn vị: ghép đúng kết quả cho nhiều yêu cầu cùng lúc, tiến độ, lỗi, worker sập, chuyển giao bộ nhớ.


### Thêm (Giai đoạn 2b – Mở nắp sâu hơn)

- "Che thử từng ô": che lần lượt 49 ô bằng màu xám, chạy lại MobileNet và đo xác suất của lớp giảm bao nhiêu (nhãn "Phép đo thật"); dùng chung lựa chọn lớp với bản đồ CAM để học sinh đối chiếu hai cách giải thích.
- "Bên trong mạng CNN" (Chuyên sâu): kích hoạt thật của 5 tầng MobileNetV2 (Conv1 112×112 → out_relu 7×7×1280), 8 kênh hoạt động mạnh nhất mỗi tầng, giải thích tầng đầu / giữa / cuối.
- Bản đồ UMAP (umap-js, seed 42, tải động) bên cạnh PCA; nhãn "Xấp xỉ", trục không có đơn vị, ẩn ranh giới quyết định.
- Chạy khi mất mạng: service worker tự viết (không thêm thư viện) lưu sẵn toàn bộ mã và mô hình; cập nhật an toàn (chỉ thay phiên bản khi các tab cũ đã đóng); chân trang báo trạng thái "dùng được cả khi mất mạng"; tệp manifest để cài như ứng dụng.
- E2E: che khuất, UMAP và các tầng CNN với mô hình thật; tắt mạng hoàn toàn rồi vẫn mở trang, tạo dự án mẫu và trích đặc trưng.

### Sửa

- Service worker dùng `ignoreVary` khi tra cache: thẻ `<script crossorigin>` gửi kèm Origin nên bản lưu có "Vary: Origin" không khớp, khiến trang trắng khi mất mạng (phát hiện nhờ E2E).

### Thêm (Giai đoạn 2a – Giải thích dự đoán)

- "Vì sao mô hình đoán như vậy?" khi chọn một ảnh: xác suất từng lớp; bản đồ "mô hình nhìn vào đâu" (CAM trên lưới 7×7, đỏ = ủng hộ, xanh = chống lại, chọn được lớp) — trùng chính xác với Grad-CAM cho kiến trúc này; nhãn "Xấp xỉ về vị trí" vì mỗi ô có vùng nhìn rộng hơn.
- Chế độ Chuyên sâu: đường đi phép tính `logit = Σ đặc trưng × trọng số + b` (5 đặc trưng đóng góp nhiều nhất, phần còn lại, độ lệch) và bảng softmax; dòng kiểm tra "trung bình 49 ô + b = logit".
- Ranh giới quyết định chính xác trên bản đồ 2D (mô hình phụ học trên 2 trục PCA), so sánh độ chính xác với mô hình chính.
- Ngưỡng tin cậy: thanh trượt, tỉ lệ dám trả lời và độ chính xác khi trả lời, biểu đồ đánh đổi.
- Kiểm thử các đẳng thức: CAM (trung bình + b = logit), phân tích logit (tổng đóng góp + b = logit), kích hoạt 7×7 trung bình bằng vector đặc trưng với mô hình thật.

### Thay đổi (công cụ phát triển)

- Nâng Vite 6 → 8 (Rolldown, build nhanh hơn khoảng 15 lần), Vitest 3 → 5, ESLint 9 → 10, jsdom 26 → 31, jest-dom 6 → 8, plugin-react 4 → 6.
- Yêu cầu Node 22.22+ / 24.15+ / 26+; CI chuyển sang Node 26.
- Tách cấu hình TypeScript: mã ứng dụng không còn thấy kiểu của Node (tránh vô tình dùng API Node trong code chạy trên trình duyệt); mã kiểm thử dùng tsconfig.test.json.
- Chia chunk theo API `codeSplitting` của Rolldown; gói tải ban đầu giữ nguyên ~193 KB gzip, TensorFlow.js vẫn tải động.

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

### Thêm (Giai đoạn 1 – phần 3)

- Nhật ký thí nghiệm: tự lưu mỗi lần huấn luyện mới (cài đặt, số ảnh, chỉ số từng epoch), so sánh tối đa 4 lần chạy trên biểu đồ, chạy lại cho đúng kết quả cũ, xóa; khi mở lại dự án tự khôi phục lần chạy gần nhất nếu dữ liệu chưa đổi (nhận biết bằng "dấu vân tay" tập dữ liệu).
- Bộ dữ liệu mẫu tổng hợp vẽ bằng thuật toán có seed: "Tròn hay vuông?", "Tròn, vuông, tam giác", "Thử thách: AI học nhầm điều gì?" (bẫy nền).
- Trang Bài học với 3 bài: mục tiêu, các bước, câu hỏi dự đoán có đáp án ẩn, câu hỏi kiểm tra nhanh có giải thích, ghi chú giáo viên; nút tạo dự án mẫu cho bài.
- E2E kiểm chứng nội dung bài học bằng MobileNetV2 thật (bộ bẫy: Dạy 100% / Kiểm tra 0%; sau khi sửa dữ liệu điểm Kiểm tra tăng).

### Sửa

- Thứ tự ảnh nay ổn định (thêm trường seq) khi nhiều ảnh được thêm cùng lúc; trước đây thứ tự phụ thuộc id ngẫu nhiên nên kết quả huấn luyện có thể khác giữa các máy.
- Bộ "bẫy nền" ban đầu không bẫy được mô hình thật (điểm Kiểm tra vẫn 100%); đã thiết kế lại với hình nhỏ, tương phản thấp.

### Thêm (Giai đoạn 1 – Studio Ảnh, phần 2)

- ③ Biểu diễn: trích đặc trưng bằng MobileNetV2 chạy trên trình duyệt (WebGL, tự chuyển CPU); TensorFlow.js chỉ tải khi cần; vector được lưu đệm trong IndexedDB.
- Xem 1.280 con số đặc trưng của một ảnh; ảnh Dạy giống nhất theo độ tương đồng cosine (giải thích bằng ví dụ).
- Bản đồ dữ liệu 2D bằng PCA (tự cài đặt, đối chiếu scikit-learn), ghi rõ phần trăm độ biến thiên giữ lại; vòng đỏ đánh dấu ảnh bị đoán sai.
- ④ Huấn luyện: tầng softmax tự cài đặt với Adam, khởi tạo Glorot và trộn dữ liệu theo seed; chế độ bình thường / chậm / từng bước; biểu đồ loss và độ chính xác; phát lại từng epoch (epoch 0 = đoán bừa); chỉnh tham số ở chế độ Chuyên sâu.
- ⑤ Đánh giá: điểm trên tập Dạy và tập Kiểm tra, cảnh báo quá khớp, ma trận nhầm lẫn bấm vào để xem ảnh, precision / recall theo lớp.
- Kiểm thử: PCA đối chiếu scikit-learn, kiểm tra đạo hàm bằng sai phân số, trích đặc trưng với mô hình thật; E2E toàn bộ quy trình với MobileNetV2 thật trên Chromium.

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
