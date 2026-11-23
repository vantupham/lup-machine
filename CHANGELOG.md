# Nhật ký thay đổi

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm (xuất notebook Google Colab – giai đoạn 3)

- Nút **"Tải notebook (.ipynb)"** ở bước ⑥ của Studio dữ liệu bảng và sau phần Đánh giá của Studio ảnh (chỉ hiện khi đã huấn luyện xong và dữ liệu chưa đổi). Notebook được tạo ngay trong trình duyệt và tải về máy; học sinh tự tải lên Colab. LUP Machine không gửi dữ liệu đi đâu.
- **Dự án bảng:** notebook chứa bảng đã làm sạch kèm cột Dạy / Kiểm tra đúng như trên LUP Machine, dựng lại cùng mô hình và tham số bằng pandas + scikit-learn, in kết quả cạnh số của LUP Machine ("khớp" / "lệch", có giải thích các trường hợp hòa của k-NN và cây), giải thích mô hình (`export_text`, trọng số, hệ số) và ô thử dự đoán.
- **Dự án ảnh:** notebook chứa vector đặc trưng float32 (base64, numpy đọc lại đúng từng bit), không chứa ảnh gốc; huấn luyện lại tầng Dense + softmax bằng Keras với cùng epoch / learning rate / batch / seed, ghép MobileNetV2 α=0.35 của Keras Applications, chuyển sang TensorFlow Lite, tự kiểm tra TFLite ↔ Keras rồi tải `lup_model.tflite` và `labels.txt` về.
- Kiểm thử đối chiếu mới `src/core/ml/keras-parity.test.ts` với tham chiếu sinh bằng Keras (`scripts/gen-keras-reference.py`): đặc trưng LUP Machine tính bằng TF.js trùng với Keras MobileNetV2 (sai khác < 0,001, cosine > 0,99999), nên tầng phân loại huấn luyện trên đặc trưng của trình duyệt dùng được với mô hình Keras.
- `scripts/check-notebooks.py` chạy thật mọi ô của các notebook mẫu. Đã chạy: 6 notebook bảng (cả 5 mô hình) khớp LUP Machine, trừ k-NN hồi quy lệch nhẹ do hòa khoảng cách như đã giải thích; notebook ảnh huấn luyện, xuất TFLite 1,6 MB, TFLite trùng Keras (chênh < 1e-6); hai notebook tải từ trình duyệt thật trong E2E cũng chạy đạt.

### Thêm (Studio dữ liệu bảng – giai đoạn 3)

- Loại dự án **Bảng số** trong Xưởng mô hình, quy trình 6 bước trên một trang:
  1. **Dữ liệu:** tải tệp CSV, dán bảng từ Excel / Google Trang tính, hoặc chọn bộ mẫu Iris (CC BY 4.0) và chim cánh cụt Palmer (CC0, giữ nguyên các ô thiếu thật); xem trước bảng, kiểu từng cột và số ô thiếu.
  2. **Chọn cột và kiểm tra:** cột nhãn, loại bài toán (phân loại / hồi quy, có gợi ý), cột đặc trưng, tỉ lệ tập Kiểm tra, chia lại theo seed; trợ lý báo dòng bị bỏ vì thiếu giá trị, mất cân bằng lớp, cột giống mã định danh, cột hằng số, dữ liệu quá ít.
  3. **Biểu diễn:** bản đồ hai cột đã chuẩn hóa; bảng cho thấy một dòng biến thành các con số (chuẩn hóa z, mã hóa one-hot).
  4. **Huấn luyện:** cây quyết định, hồi quy logistic (C), k-NN (k); hồi quy tuyến tính, k-NN hồi quy. Đổi dữ liệu / cấu hình thì kết quả cũ bị ẩn cho tới khi huấn luyện lại.
  5. **Đánh giá:** độ chính xác Dạy / Kiểm tra, cảnh báo quá khớp, ma trận nhầm lẫn; R² và RMSE, biểu đồ giá trị thật – dự đoán; giải thích mô hình (sơ đồ cây và độ quan trọng cột, trọng số từng lớp, phương trình hồi quy).
  6. **Sử dụng:** nhập một dòng mới, xem xác suất và lý do (đường đi trên cây, các láng giềng gần nhất, các đóng góp lớn nhất).
- Đọc CSV an toàn với dữ liệu không tin cậy: ngoặc kép RFC 4180, tự nhận dấu phẩy / chấm phẩy / tab, BOM, dấu phẩy thập phân kiểu Việt Nam, giới hạn 2 MB / 5.000 dòng / 40 cột, báo lỗi kèm số dòng.
- Bảng và cấu hình lưu trong IndexedDB (bảng `dataTables`, phiên bản cơ sở dữ liệu 5), cấu hình được kiểm tra bằng zod khi đọc; xóa dự án thì xóa luôn bảng.
- Hồi quy logistic (tối ưu bằng L-BFGS tự cài đặt) và k-NN hồi quy đối chiếu với scikit-learn: trọng số, độ lệch và xác suất khớp tới 1e-6 cho cả 2 lớp và 3 lớp.

### Thêm (Sân chơi thuật toán – giai đoạn 3)

- Trang **Sân chơi thuật toán** (`#/playground`, có trên thanh điều hướng) với 6 thuật toán chạy trên dữ liệu 2D sinh theo seed (ba đám mây, XOR, hai vòng tròn, hai trăng khuyết, xoắn ốc):
  - **k-NN:** bấm để đặt điểm cần đoán, thấy đường nối tới k láng giềng và bảng phiếu bầu; vùng phân loại đổi theo k; thêm / xóa điểm.
  - **Cây quyết định:** Gini hoặc entropy, độ sâu tối đa; "mọc thêm một nút" theo từng tầng, sơ đồ cây ghi ngưỡng, số mẫu, độ tạp chất; biểu đồ độ chính xác Dạy / Kiểm tra theo độ sâu để thấy quá khớp.
  - **Hồi quy tuyến tính:** tự kéo độ dốc và độ lệch, hình vuông sai số, MSE của em so với đường bình phương tối thiểu của máy, nút "cho máy sửa một bước" bằng gradient descent.
  - **Gradient descent:** 3 mặt lỗi có công thức (cái chén, thung lũng hẹp, hai hố), bản đồ đồng mức, chọn điểm xuất phát, từng bước hiện ∇f và phép cập nhật bằng số thật, cảnh báo khi η quá lớn.
  - **k-means:** từng pha khởi đầu → gán → dời tâm, tâm khởi đầu k-means++ có seed, tổng bình phương khoảng cách, báo hội tụ.
  - **Mạng nơ-ron mini:** 1–2 tầng ẩn, 1–8 nơ-ron, tanh / ReLU / sigmoid, huấn luyện trực tiếp, biểu đồ loss, vùng phân loại theo độ chắc chắn và bản đồ đầu ra của từng nơ-ron ẩn.
- Lõi thuật toán thuần TypeScript trong `src/core/algorithms/` (không phụ thuộc React), kiểm thử đối chiếu với **scikit-learn 1.8**: k-NN (nhãn, láng giềng, khoảng cách), cây quyết định (toàn bộ cấu trúc cây, ngưỡng tới độ chính xác float32, độ quan trọng đặc trưng, dự đoán), hồi quy tuyến tính (hệ số, MSE, R²), k-means (tâm, nhãn, inertia, số vòng lặp), mạng nơ-ron (xác suất và trọng số sau đúng một bước SGD, sai số < 1e-9). Đạo hàm của mạng nơ-ron và các mặt lỗi được kiểm tra thêm bằng sai phân số.

### Thêm (biểu tượng ứng dụng)

- Biểu tượng PNG 192 và 512 px, bản maskable 512 px (nền kín khung, logo trong vùng an toàn để Android cắt tròn / bo góc) và apple-touch-icon 180 px cho iPhone / iPad khi "Thêm vào màn hình chính". Trình duyệt cũ chưa hỗ trợ biểu tượng SVG trong manifest nay cũng cài được ứng dụng.
- `scripts/build-icons.mjs` dựng lại toàn bộ biểu tượng từ `public/favicon.svg` bằng Chromium của Playwright (không thêm thư viện).
- Kiểm thử đọc kích thước thật trong tệp PNG so với khai báo trong manifest; E2E dùng Chromium kiểm tra ứng dụng cài đặt được (không có lỗi cài đặt), mọi biểu tượng tải được và có trong bộ nhớ ngoại tuyến.

### Thêm (số liệu mẫu cho bài 1–3)

- Phiếu bài tập bài 1–3 có khung ghi kết quả; bản giáo viên điền sẵn số liệu mẫu đo bằng MobileNetV2 thật: bài 1 màu điểm ảnh nền và hình tròn của ảnh đầu tiên, 224 × 224 × 3 = 150.528; bài 2 tỉ lệ biến thiên bản đồ, điểm theo epoch (0 / 5 / 50), ma trận nhầm lẫn ở epoch 5, thí nghiệm 3 epoch; bài 3 điểm và ma trận lúc có bẫy, so sánh trước / sau khi sửa dữ liệu, gợi ý đáp án bước tìm bằng chứng.
- Kiểm thử nhất quán cho mọi bài (kích thước ma trận, mỗi hàng đủ số ảnh Kiểm tra, kích thước bảng) và riêng từng bài (màu mẫu khớp thông số sinh ảnh; đường chéo khớp điểm Kiểm tra). E2E đối chiếu số liệu mẫu với lần chạy thật, và kiểm chứng đáp án bài 3: ảnh Dạy giống nhất của hình tròn bị đoán sai đều là hình vuông.

### Sửa (nội dung bài 2)

- Câu dự đoán epoch 0: thực tế đo được 22% / 44% chứ không "lệch một chút" so với 33% (trọng số ban đầu ngẫu nhiên, tập Kiểm tra nhỏ) — đã sửa lời giải thích.
- Bước ⑤: ở epoch 50 mô hình đúng hết nên không có ô ngoài đường chéo để tìm; nay hướng dẫn kéo thanh Phát lại về epoch 5 (lúc còn nhầm 3 vuông → tam giác).

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
