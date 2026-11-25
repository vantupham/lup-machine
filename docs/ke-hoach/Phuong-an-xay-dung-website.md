# Phương án xây dựng website dạy và học AI "nhìn thấy bên trong"

> Tài liệu thứ 3 trong bộ: [Đánh giá Teachable Machine](Danh-gia-Teachable-Machine.md) → [Đề xuất nâng cấp](De-xuat-nang-cap-Teachable-Machine.md) → **Phương án xây dựng**.
> Tên dự án tạm gọi: **LUP Machine** (có thể đổi).
> Hình thức: mã nguồn mở trên GitHub, chạy miễn phí trên **GitHub Pages**.
> Ngày lập: 22/11/2026

---

## 1. Tầm nhìn và phạm vi

### 1.1. Tầm nhìn

Một **phòng thí nghiệm AI trên trình duyệt** cho học sinh THCS–THPT. Ở đó mọi bước AI xử lý dữ liệu do chính học sinh cung cấp đều **nhìn thấy được, đo được, giải thích được**: từ ảnh hoặc âm thanh thô, qua trích đặc trưng và huấn luyện, đến dự đoán và lỗi sai.

### 1.2. Đối tượng

| Đối tượng | Nhu cầu chính |
|---|---|
| Học sinh THCS (lớp 6–9) | Trực quan, dễ, vui, tiếng Việt, ít số liệu |
| Học sinh THPT (lớp 10–12) | Hiểu cơ chế, số liệu thật, thuật toán, xem mã nguồn |
| Giáo viên Tin học / STEM | Giáo án sẵn, giao bài, chấm bài, chạy được trên máy phòng tin yếu |
| Nhà trường | Miễn phí, an toàn dữ liệu học sinh, không cần máy chủ |

### 1.3. Điểm khác biệt so với Teachable Machine

| Teachable Machine | LUP Machine |
|---|---|
| Hộp đen, chỉ có thanh tiến trình | Mọi bước có "Kính hiển vi" (Inspector) để xem bên trong |
| Chỉ có ảnh, âm thanh, tư thế | Thêm văn bản tiếng Việt, dữ liệu bảng, thuật toán cổ điển |
| Không tách tập kiểm tra | Tách Dạy / Kiểm tra bắt buộc, cảnh báo quá khớp |
| Không so sánh các lần chạy | Nhật ký thí nghiệm, so sánh song song |
| Tiếng Anh | Tiếng Việt mặc định, có tiếng Anh |
| Không có công cụ lớp học | Gói bài tập, nộp bài, chấm theo rubric mà không cần máy chủ |
| Không có nội dung bài học | Bài học tương tác và giáo án tích hợp |

---

## 2. Ràng buộc quyết định kiến trúc

| Ràng buộc | Hệ quả thiết kế |
|---|---|
| Đăng trên **GitHub Pages** (chỉ phục vụ trang tĩnh, không có máy chủ) | **100% xử lý phía trình duyệt.** Lưu trữ dùng IndexedDB và tệp. Lớp học thực hiện qua trao đổi tệp. |
| Học sinh là **trẻ vị thành niên** | Không thu thập dữ liệu cá nhân, không tài khoản bắt buộc, không theo dõi (tracking), dữ liệu không rời máy |
| **Máy phòng tin yếu** (RAM 4 GB, card đồ họa tích hợp) | Mô hình nhỏ, chạy được trên CPU, giới hạn số mẫu, có chế độ "nhẹ" |
| **Mạng yếu hoặc chập chờn** | Ứng dụng web cài được, chạy ngoại tuyến (PWA); tự lưu trữ mô hình trong repo, không phụ thuộc CDN bên ngoài |
| Giới hạn GitHub Pages: site ~1 GB, mỗi tệp < 100 MB, ~100 GB băng thông/tháng | Tổng mô hình và dữ liệu mẫu ≤ 300 MB; bộ dữ liệu lớn để ở GitHub Releases |
| Không đặt được HTTP header trên GitHub Pages | Chính sách bảo mật nội dung (CSP) đặt qua thẻ `<meta>`; không dùng tính năng cần header đặc biệt (ví dụ SharedArrayBuffer) |
| Phải **đáng tin cậy** về khoa học | Mọi hình trực quan đều ghi rõ là **chính xác** hay **xấp xỉ**; thuật toán được kiểm thử đối chiếu với thư viện chuẩn |

---

## 3. Sơ đồ trang (sitemap)

```
LUP Machine
├── 🏠 Trang chủ             – giới thiệu, chọn vai trò (Học sinh / Giáo viên), chọn chế độ (Khám phá / Chuyên sâu)
├── 🧪 Xưởng mô hình (Studio)
│   ├── Ảnh
│   ├── Âm thanh
│   ├── Tư thế & bàn tay
│   ├── Văn bản tiếng Việt
│   └── Dữ liệu bảng (CSV)
├── 🔬 Kính hiển vi (Inspector) – mở được từ mọi bước trong Studio
├── 📊 Phòng thí nghiệm (Experiments) – nhật ký, so sánh các lần chạy, phiếu thí nghiệm
├── 🧮 Sân chơi thuật toán (Playground) – k-NN, cây quyết định, hồi quy, k-means, mạng nơ-ron mini, gradient descent
├── ⚖️ Phòng đạo đức AI (Ethics Lab) – thiên lệch, quyền riêng tư, thẻ mô hình
├── 📚 Bài học              – bài học tương tác theo khối lớp, gắn với các phòng ở trên
├── 🧩 Khối lệnh & Phần cứng – lập trình khối, kết nối micro:bit / Arduino
├── 👩‍🏫 Góc giáo viên         – tạo gói bài tập, chấm bài nộp, giáo án, chế độ trình chiếu
├── 📖 Từ điển AI            – thuật ngữ Việt – Anh, có minh họa
└── ℹ️ Giới thiệu            – quyền riêng tư, giải thích kỹ thuật, giấy phép, đóng góp
```

---

## 4. Chức năng chi tiết

### 4.1. Xưởng mô hình (Studio): quy trình 6 bước

Thay quy trình 3 bước của Teachable Machine bằng **6 bước**. Bước nào cũng có nút 🔬 mở Kính hiển vi.

```
① Dữ liệu → ② Kiểm tra dữ liệu → ③ Biểu diễn (đặc trưng) → ④ Huấn luyện → ⑤ Đánh giá → ⑥ Sử dụng & Xuất
```

| Bước | Chức năng | Học sinh thấy được gì |
|---|---|---|
| ① Dữ liệu | Thêm lớp; thu bằng webcam / micro / tải tệp / dùng bộ mẫu. Mỗi lớp có 2 ngăn **Dạy** và **Kiểm tra** (tự chia 80/20 hoặc kéo thả). | Dữ liệu là gì, nhãn là gì |
| ② Kiểm tra dữ liệu | Trợ lý chất lượng: mất cân bằng, trùng lặp, mờ hoặc tối, nền giống nhau, nghi dán nhãn sai, thiếu đa dạng | Dữ liệu tốt và dữ liệu xấu |
| ③ Biểu diễn | Xem ảnh thành bảng số, thành vector đặc trưng; xem bản đồ 2D của toàn bộ dữ liệu | Máy "nhìn" dữ liệu như thế nào |
| ④ Huấn luyện | Chọn tham số (theo chế độ); huấn luyện thường / chậm / từng bước; đồ thị loss và accuracy trực tiếp; ranh giới quyết định dịch chuyển | Huấn luyện = đoán → so đáp án → sửa lỗi, lặp lại |
| ⑤ Đánh giá | Điểm trên tập Dạy và tập Kiểm tra; ma trận nhầm lẫn bấm được; precision / recall; ngưỡng tin cậy | Mô hình giỏi đến đâu, sai ở đâu |
| ⑥ Sử dụng & Xuất | Thử trực tiếp kèm giải thích; xuất dự án, mô hình, mã nguồn, notebook Colab; nối sang khối lệnh và phần cứng | AI được đưa vào ứng dụng ra sao |

#### Năm loại dự án

| Loại | Đầu vào | Biểu diễn (đặc trưng) | Mô hình học | Điểm "mở nắp" đặc biệt |
|---|---|---|---|---|
| **Ảnh** | Webcam, tệp ảnh | MobileNet (vector 1024 hoặc 1280 chiều) | Lớp Dense + softmax; hoặc k-NN | Lưới điểm ảnh RGB, bản đồ đặc trưng các tầng CNN, heatmap Grad-CAM / che khuất |
| **Âm thanh** | Micro, tệp WAV/MP3 | Ảnh phổ (spectrogram / mel) → bộ trích đặc trưng âm thanh | Dense + softmax | Dạng sóng → phổ tần số → ảnh phổ theo thời gian thực; vùng phổ quan trọng |
| **Tư thế & bàn tay** | Webcam | 17 khớp xương (MoveNet) hoặc 21 điểm bàn tay → chuẩn hóa tọa độ | Dense hoặc k-NN | Khung xương, bảng tọa độ, khớp nào ảnh hưởng nhiều nhất |
| **Văn bản tiếng Việt** | Gõ, dán, CSV | **Mặc định:** túi từ / TF-IDF theo âm tiết (minh bạch). **Nâng cao:** nhúng câu đa ngôn ngữ | Hồi quy logistic / Naive Bayes / Dense | Tách từ, bảng tần suất, **trọng số từng từ** tô màu trong câu |
| **Dữ liệu bảng** | CSV, nhập tay | Các cột số / phân loại, chuẩn hóa | Hồi quy tuyến tính / logistic, cây quyết định, k-NN, mạng nơ-ron mini | Biểu đồ phân tán, cây vẽ ra, đường hồi quy, tầm quan trọng của đặc trưng |

### 4.2. Kính hiển vi (Inspector): trái tim của hệ thống

Mỗi công cụ trực quan đều có nhãn **"Mức độ chính xác"** để giữ độ tin cậy khoa học:

- 🟩 **Chính xác:** đúng những gì mô hình tính toán.
- 🟨 **Xấp xỉ:** minh họa gần đúng, có ghi rõ lý do.

| Công cụ | Mô tả | Mức độ | Chế độ |
|---|---|---|---|
| **Xem điểm ảnh** | Phóng to tới từng ô, xem giá trị RGB; thanh trượt chuyển từ "ảnh" sang "bảng số" | 🟩 | Khám phá |
| **Tiền xử lý** | Ảnh gốc → cắt → thu về 224×224 → chuẩn hóa [-1, 1], hiển thị từng bước | 🟩 | Cả hai |
| **Bản đồ đặc trưng CNN** | Kết quả của một số kênh ở tầng đầu, giữa và cuối mạng | 🟩 | Chuyên sâu |
| **Vector đặc trưng** | Hiển thị 1024 số dưới dạng dải màu; so sánh vector của 2 ảnh và độ tương đồng cosine | 🟩 | Cả hai |
| **Bản đồ dữ liệu 2D** | PCA (🟩 phép chiếu tuyến tính) hoặc UMAP (🟨 bảo toàn lân cận); chấm webcam di chuyển trực tiếp; bấm chấm để xem ảnh gốc | 🟩 / 🟨 | Cả hai |
| **Ranh giới quyết định** | **Chế độ học 2D:** mô hình được huấn luyện trên chính 2 trục PCA, nên ranh giới hiển thị là 🟩 *chính xác*. Ở chế độ đầy đủ, ranh giới chỉ là minh họa 🟨. | 🟩 / 🟨 | Cả hai |
| **Heatmap Grad-CAM** | Vùng ảnh có gradient ảnh hưởng mạnh tới lớp được chọn | 🟨 (độ phân giải thấp 7×7, phóng lên) | Cả hai |
| **Bản đồ che khuất (occlusion)** | Che lần lượt từng ô và đo xác suất giảm bao nhiêu. Dễ giải thích nhất cho THCS. | 🟩 (đúng là phép đo thực) | Khám phá |
| **Giải thích bằng ví dụ** | 3 mẫu huấn luyện gần nhất trong không gian đặc trưng | 🟩 | Cả hai |
| **Đường đi của phép tính** | Đặc trưng × trọng số + độ lệch → logit → softmax → xác suất, hiển thị số thật | 🟩 | Chuyên sâu |
| **Phát lại quá trình huấn luyện** | Ghi lại trọng số sau mỗi epoch; tua đi tua lại để xem dự đoán thay đổi | 🟩 | Cả hai |
| **Ảnh phổ âm thanh** | Dạng sóng, FFT, mel-spectrogram theo thời gian thực | 🟩 | Cả hai |
| **Trọng số từ** (văn bản) | Màu xanh/đỏ trên từng từ theo đóng góp vào lớp dự đoán | 🟩 (với mô hình tuyến tính) | Cả hai |

### 4.3. Phòng thí nghiệm (Experiments)

- **Nhật ký tự động:** mỗi lần huấn luyện lưu lại cấu hình, số mẫu, seed ngẫu nhiên, thời gian, kết quả Dạy / Kiểm tra và ma trận nhầm lẫn.
- **So sánh:** chọn 2–4 lần chạy để xem bảng và đồ thị chồng nhau.
- **Phiếu thí nghiệm:** Câu hỏi → Giả thuyết → Biến thay đổi → Kết quả (tự điền từ nhật ký) → Kết luận. Xuất PDF hoặc đính kèm khi nộp bài.
- **Thí nghiệm có sẵn:** số mẫu và độ chính xác; learning rate; nhãn nhiễu 0–50%; tăng cường dữ liệu bật / tắt; mất cân bằng lớp.
- **Tái lập kết quả:** seed cố định, nên cùng dữ liệu và cùng seed cho cùng kết quả. Học sinh hiểu "thí nghiệm phải lặp lại được".

### 4.4. Sân chơi thuật toán (Playground)

Thuật toán tự cài đặt bằng TypeScript, chạy được **từng bước**, dữ liệu 2D để nhìn rõ:

| Thuật toán | Học sinh tương tác | Khái niệm |
|---|---|---|
| k-NN | Click đặt điểm, kéo thanh k, thấy vùng phân loại đổi | Láng giềng, khoảng cách, k lớn và k nhỏ |
| Cây quyết định | Xem cây "mọc" từng nút, chỉ số Gini / entropy, chiều sâu tối đa | Luật if–then, quá khớp |
| Hồi quy tuyến tính | Kéo đường thẳng bằng tay rồi so với máy; xem sai số bình phương | Hàm mất mát |
| Gradient descent | Viên bi lăn trên mặt lỗi 3D, chỉnh learning rate | Tối ưu hóa |
| Perceptron / mạng nơ-ron mini | Mạng 2–3 tầng với dữ liệu XOR, hình tròn, xoắn ốc; xem từng nơ-ron "vẽ" gì | Tầng ẩn, hàm kích hoạt |
| k-means | Tâm cụm di chuyển qua từng vòng lặp | Học không giám sát |
| Q-learning mini | Robot đi mê cung, bảng Q cập nhật theo thời gian | Học tăng cường |
| "Dự đoán từ tiếp theo" | Mô hình bigram/n-gram trên văn bản tiếng Việt nhỏ; xem bảng xác suất | Nền tảng của mô hình ngôn ngữ (ChatGPT) |

### 4.5. Phòng đạo đức AI (Ethics Lab)

- **Kịch bản thiên lệch** có bộ dữ liệu "bẫy" cài sẵn: huấn luyện, phát hiện mô hình kém với một nhóm, sửa dữ liệu, đo lại. Bản THPT có **độ chính xác theo từng nhóm con**.
- **Thẻ mô hình (Model Card):** phải điền trước khi xuất hoặc nộp bài.
- **"Dữ liệu của em đi đâu?":** sơ đồ trực quan cho thấy dữ liệu chỉ nằm trên máy, kèm bài học về quyền riêng tư.
- **Tình huống thảo luận** gắn với dự án vừa làm (trách nhiệm, sai số, ứng dụng nhạy cảm như nhận diện khuôn mặt).
- **Đã làm (giai đoạn 5):**
  - trang `#/dao-duc`;
  - thí nghiệm "bệnh lá lúa Đồng bằng / Miền núi" 3 bước (dữ liệu lệch → thêm dữ liệu → thêm bối cảnh), khẳng định kiểm thử trên 10 lần lấy mẫu;
  - sơ đồ dữ liệu đi đâu;
  - 4 tình huống thảo luận.

### 4.6. Bài học tương tác

- Mỗi bài gồm: mục tiêu → hoạt động khởi động → thực hành (mở thẳng Studio/Playground với cấu hình sẵn) → câu hỏi "dự đoán trước" → kiểm tra nhanh → tổng kết.
- Phân theo khối 6–12; gắn với các chủ đề AI, học máy và khoa học dữ liệu trong chương trình Tin học phổ thông.
- Viết bằng **MDX** (Markdown có nhúng thành phần tương tác), nên giáo viên đóng góp bài mới dễ dàng qua GitHub.

### 4.7. Khối lệnh và phần cứng

- **Blockly** tích hợp, có khối "khi nhận ra [lớp] với độ tin cậy > [x]%", điều khiển nhân vật trên sân khấu.
- **Web Serial / Web Bluetooth** kết nối micro:bit, Arduino, ESP32 / Yolo:Bit. Ánh xạ "lớp → lệnh gửi đi", kèm mã firmware mẫu.
- Lưu ý: Web Serial và Web Bluetooth chỉ chạy trên Chrome / Edge máy tính.

### 4.8. Góc giáo viên (không cần máy chủ)

Lớp học được tổ chức qua **trao đổi tệp** để giữ nguyên nguyên tắc "không máy chủ, không thu dữ liệu":

```
Giáo viên                                   Học sinh
─────────                                   ────────
Tạo "Gói bài tập" (.lupa)                    
 • đề bài, dữ liệu mẫu, cấu hình, rubric     
 • chia sẻ qua Zalo / Drive / USB / LMS ──→ Mở gói → làm bài trong Studio
                                             → Nộp: xuất "Bài nộp" (.lups)
Nhập nhiều tệp bài nộp ←──────────────────── gồm dự án + nhật ký + thẻ mô hình + phiếu TN
 • bảng tổng hợp cả lớp                      (tùy chọn: bỏ ảnh gốc, chỉ giữ đặc trưng)
 • chấm theo rubric, xuất Excel
```

- **Đã làm (giai đoạn 5):**
  - `.lupa` là zip gồm `manifest.json`, `assignment.json` (đề, câu hỏi, rubric) và `project.lup` tùy chọn;
  - `.lups` là zip gồm `manifest.json`, `submission.json` (đề, học sinh, câu trả lời, số liệu) và `project.lup`;
  - bài nộp mặc định không kèm dữ liệu gốc;
  - chỉ nộp được khi thẻ mô hình đã điền đủ;
  - giáo viên nhận nhiều `.lups` cùng lúc, chấm theo rubric và xuất bảng điểm `.xlsx`.
- **Chế độ trình chiếu** (đã làm ở giai đoạn 5): chữ to (4 cỡ), ẩn chi tiết phụ, có con trỏ laser, phím tắt `+ − L F Esc`.
- **Kho giáo án:** tải giáo án dạng DOCX/PDF kèm gói bài tập tương ứng.
- **Giai đoạn sau (tùy chọn):** lớp học trực tuyến theo thời gian thực qua backend riêng (Supabase/Firebase) do nhà trường tự triển khai. Tính năng này nằm ngoài bản GitHub Pages mặc định.

### 4.9. Xuất và tích hợp

| Định dạng | Dùng cho |
|---|---|
| Dự án `.lup` (zip: dữ liệu + cấu hình + nhật ký) | Lưu, chia sẻ, mở lại |
| Mô hình TensorFlow.js (`model.json` + trọng số) | Nhúng web, p5.js |
| Đoạn mã HTML/JS mẫu | Chạy mô hình trên trang web riêng |
| **Notebook Colab** (Python/Keras) kèm dữ liệu đặc trưng | Học lên lập trình; tự chuyển sang TFLite / Keras |
| Firmware mẫu micro:bit / Arduino | Phần cứng |

> Trình duyệt **không chuyển đổi trực tiếp sang TFLite được**. Notebook Colab đảm nhiệm bước này, và trang web nói rõ điều đó với người dùng.

---

## 5. Kiến trúc kỹ thuật

### 5.1. Công nghệ chọn dùng

| Lớp | Công nghệ | Lý do |
|---|---|---|
| Ngôn ngữ | **TypeScript** (strict) | An toàn kiểu, dễ bảo trì khi nhiều người đóng góp |
| Khung giao diện | **React** + **Vite** | Hệ sinh thái lớn, nhiều người biết, build tĩnh nhanh |
| Định tuyến | React Router (HashRouter) | GitHub Pages không hỗ trợ viết lại URL |
| Trạng thái | **Zustand** (cập nhật bất biến) | Nhẹ, đơn giản |
| Giao diện | **Tailwind CSS** + Radix UI | Truy cập tốt (a11y), tùy biến nhanh |
| Học máy | **TensorFlow.js** (WebGL; WebGPU nếu có; CPU dự phòng) | Huấn luyện và suy luận trên trình duyệt, có gradient cho Grad-CAM |
| Tư thế / tay / khuôn mặt | `@tensorflow-models/pose-detection` (MoveNet), MediaPipe Tasks (Hand / Face) | Hiện đại, chạy nhanh |
| Văn bản nâng cao | Transformers.js + mô hình nhúng câu đa ngôn ngữ đã lượng tử hóa (tải khi cần) | Hỗ trợ tiếng Việt |
| Thuật toán cổ điển | **Tự cài đặt** (k-NN, cây quyết định, hồi quy, k-means, PCA, Naive Bayes, TF-IDF) | Chạy được từng bước, minh bạch, kiểm soát được |
| Giảm chiều | PCA tự cài + `umap-js` | Bản đồ 2D |
| Trực quan | **D3** (bản đồ, cây, heatmap) + Canvas/WebGL cho dữ liệu lớn; uPlot cho đồ thị | Hiệu năng cao, tùy biến hoàn toàn |
| Âm thanh | Web Audio API + AudioWorklet, FFT/mel tự cài | Ảnh phổ thời gian thực |
| Lưu trữ | **IndexedDB** qua Dexie; JSZip cho tệp dự án | Lưu cục bộ, không máy chủ |
| Kiểm tra dữ liệu nhập | **Zod** (schema cho mọi tệp nhập) | Không tin dữ liệu từ ngoài |
| Đa ngôn ngữ | i18next (vi mặc định, en) | |
| Bài học | MDX | Giáo viên dễ đóng góp |
| Khối lệnh | Blockly | Chuẩn lập trình khối |
| Ngoại tuyến | vite-plugin-pwa (Workbox) | Cache mô hình, chạy không mạng |
| Luồng nền | Web Worker + OffscreenCanvas | Huấn luyện không làm treo giao diện |
| Kiểm thử | Vitest, Testing Library, Playwright | Unit, tích hợp, E2E |
| CI/CD | GitHub Actions → GitHub Pages | Tự động kiểm thử và triển khai |

> Mọi phụ thuộc được **ghim phiên bản chính xác** trong `package.json` + lockfile, và cập nhật có kiểm soát qua Dependabot.

### 5.2. Sơ đồ kiến trúc

```
┌──────────────────────────────── Trình duyệt (100% phía máy khách) ────────────────────────────────┐
│                                                                                                    │
│  ┌──────────── Giao diện (React) ────────────┐        ┌──────────── Web Worker ML ────────────┐   │
│  │ Studio │ Inspector │ Experiments │ ...    │◄──────►│ Huấn luyện / suy luận TF.js           │   │
│  └──────┬────────────────────────────┬───────┘ postMsg│ Grad-CAM, occlusion, PCA, UMAP        │   │
│         │                            │                │ Ghi snapshot trọng số theo epoch      │   │
│  ┌──────▼──────┐   ┌──────────────── ▼ ──────────┐    └──────────────▲────────────────────────┘   │
│  │ Store       │   │ Lõi ML (thuần TS, test được)│                   │                            │
│  │ (Zustand)   │   │ • pipelines/ image audio …  │───────────────────┘                            │
│  └──────┬──────┘   │ • algorithms/ knn tree …    │                                                │
│         │          │ • explain/ gradcam occl …   │    ┌─────────── Thiết bị ───────────┐          │
│  ┌──────▼──────────┴─────────────────────────────┐    │ Webcam · Micro · Web Serial/BLE │          │
│  │ Kho dữ liệu (Repository) – IndexedDB / Dexie   │    └─────────────────────────────────┘          │
│  │ projects · samples · runs · snapshots          │                                                │
│  └──────┬─────────────────────────────────────────┘                                                │
│         │ xuất / nhập .lup .lupa .lups (Zip + Zod)                                                 │
└─────────┼──────────────────────────────────────────────────────────────────────────────────────────┘
          ▼
   Tệp trên máy người dùng          GitHub Pages: HTML/JS + mô hình nền (tự lưu trữ) + dữ liệu mẫu
```

**Nguyên tắc tách lớp:**

- **Lõi ML** là TypeScript thuần, không phụ thuộc React, nên kiểm thử độc lập được và tái sử dụng được trong Worker.
- **Repository pattern** cho lưu trữ: giao diện chuẩn `findAll / findById / create / update / delete`. Sau này muốn thay IndexedDB bằng backend thì không phải sửa logic.
- **Bất biến:** mọi cập nhật trạng thái đều tạo đối tượng mới. Mỗi lần huấn luyện tạo ra một `Run` mới, không ghi đè lần trước.

### 5.3. Luồng xử lý dự án ảnh (ví dụ)

```
Webcam/ảnh ─► tiền xử lý (crop, resize 224, normalize) ─► MobileNet (đóng băng) ─► vector 1024
                     │ [Inspector: điểm ảnh, tiền xử lý]       │ [Inspector: feature maps]
                     ▼                                          ▼
              lưu ảnh thu nhỏ                           CACHE vector vào IndexedDB
                                                        (chỉ trích đặc trưng 1 lần/ảnh
                                                         → huấn luyện lại rất nhanh)
                                                                │
                              ┌─────────────────────────────────┼──────────────────────────┐
                              ▼                                 ▼                          ▼
                     PCA/UMAP → bản đồ 2D        Dense+softmax (seed cố định)       k-NN (so sánh)
                                                  │ snapshot mỗi epoch
                                                  ▼
                          Đánh giá Dạy/Kiểm tra → ma trận nhầm lẫn → giải thích dự đoán
                                       (Grad-CAM cần mô hình đầy đủ: nền + đầu ghép lại)
```

**Mô hình nền:** dùng MobileNetV2/V3 dạng **LayersModel** của TF.js (chuyển từ Keras), **tự lưu trữ** trong repo:

- Truy cập được tầng trung gian cho bản đồ đặc trưng và Grad-CAM.
- Không phụ thuộc CDN bên ngoài, chạy được ngoại tuyến.
- Có bản `alpha=0.5` (~5–8 MB) cho máy yếu và bản `alpha=1.0` cho máy tốt.

### 5.4. Định dạng tệp dự án `.lup`

```
project.lup (zip)
├── manifest.json      ← phiên bản định dạng, loại dự án, tên, ngày tạo, phiên bản ứng dụng
├── classes.json       ← danh sách lớp theo thứ tự (dự án ảnh / âm thanh / tư thế)
├── images.json        ← mỗi ảnh: tệp, lớp, ngăn Dạy/Kiểm tra, nguồn, ghi công (nếu có)
├── samples/           ← ảnh đã chuẩn hóa (JPEG/PNG 224 px)
├── audio.json + audio/← đoạn 1 giây, WAV một kênh 16 kHz, số thực 32 bit
├── poses.json         ← chỉ tọa độ khớp (không có ảnh)
├── table.csv + table.json ← dự án bảng / văn bản: CSV gốc và cấu hình
├── runs.json          ← nhật ký mỗi lần huấn luyện (cấu hình, seed, chỉ số)
└── model-card.json    ← thẻ mô hình học sinh đã viết (nếu có)
```

- Vector đặc trưng **không** đưa vào tệp (trình duyệt tính lại được); mô hình không lưu trọng số vì huấn luyện lại với cùng seed cho đúng kết quả cũ.
- Mọi tệp nhập vào đều được **xác thực bằng Zod**; ảnh được kiểm tra đúng là JPEG/PNG, WAV đúng định dạng.
- Giới hạn kích thước tệp, số tệp và kích thước giải nén (chống "zip bomb"); chỉ đọc những tên tệp đã biết.
- Có trường `formatVersion` để **chuyển đổi phiên bản (migration)** khi định dạng thay đổi.

### 5.5. Hiệu năng và yêu cầu thiết bị

| Mức máy | Cấu hình | Chế độ tự chọn |
|---|---|---|
| Yếu | RAM 4 GB, card tích hợp đời cũ, chỉ có CPU | **Nhẹ:** MobileNet α=0.5, ≤ 50 mẫu/lớp, tắt UMAP (chỉ PCA), Grad-CAM theo yêu cầu |
| Trung bình | RAM 8 GB, WebGL tốt | **Chuẩn** |
| Mạnh | Có WebGPU | **Đầy đủ:** α=1.0, nhiều mẫu, UMAP thời gian thực |

- Tự đo năng lực máy khi mở lần đầu (benchmark ~2 giây) để chọn chế độ.
- **Trích đặc trưng một lần rồi cache**, huấn luyện lớp đầu chỉ mất vài giây.
- Giải phóng tensor chặt chẽ (`tf.tidy`, `dispose`), có theo dõi rò rỉ bộ nhớ trong kiểm thử.
- Mục tiêu: trang đầu tải < 3 giây trên mạng 4G; JS ban đầu < 300 KB (gzip); mô hình chỉ tải khi cần.

---

## 6. Cấu trúc repository

```
lup-machine/
├── .github/
│   ├── workflows/          ci.yml · deploy.yml · codeql.yml
│   ├── ISSUE_TEMPLATE/     bao-loi.md · de-xuat.md · gop-bai-hoc.md
│   └── dependabot.yml
├── public/
│   ├── models/             mobilenet-v2-050/ · movenet/ · audio/   (tự lưu trữ)
│   └── datasets/           bộ mẫu nhỏ (bộ lớn để ở GitHub Releases)
├── src/
│   ├── app/                routes, layout, providers
│   ├── features/
│   │   ├── studio/         image/ audio/ pose/ text/ tabular/
│   │   ├── inspector/      pixel-view/ feature-map/ embedding-map/ gradcam/ ...
│   │   ├── experiments/
│   │   ├── playground/     knn/ decision-tree/ regression/ gradient-descent/ ...
│   │   ├── ethics/
│   │   ├── lessons/
│   │   ├── blocks/         Blockly + hardware
│   │   └── teacher/
│   ├── core/               ← lõi thuần TS, không phụ thuộc React
│   │   ├── ml/             pipelines/ heads/ training/ explain/
│   │   ├── algorithms/     knn.ts · tree.ts · linreg.ts · kmeans.ts · pca.ts · tfidf.ts · ...
│   │   ├── audio/          fft.ts · mel.ts
│   │   ├── data/           quality-checks.ts · split.ts · augment.ts
│   │   └── random/         seeded-rng.ts
│   ├── workers/            ml.worker.ts
│   ├── storage/            repositories/ · schemas/ (zod) · migrations/ · project-file.ts
│   ├── ui/                 components dùng chung, theme
│   └── i18n/               vi.json · en.json
├── content/
│   ├── lessons/            lop-6/ ... lop-12/  (*.mdx)
│   ├── glossary/           thuật ngữ
│   └── lesson-plans/       giáo án DOCX/PDF
├── tests/
│   ├── unit/ · integration/ · e2e/
│   └── fixtures/           dữ liệu và kết quả tham chiếu (sinh từ scikit-learn)
├── scripts/                convert-models.py · build-datasets.py · gen-reference-results.py
├── docs/                   kien-truc.md · giai-thich-ky-thuat.md · huong-dan-dong-gop.md
├── README.md · LICENSE · CONTENT_LICENSE · PRIVACY.md · CHANGELOG.md · CODE_OF_CONDUCT.md
└── package.json · vite.config.ts · tsconfig.json
```

---

## 7. Quyền riêng tư, bảo mật và pháp lý

### 7.1. Quyền riêng tư (ưu tiên số 1 vì người dùng là trẻ vị thành niên)

- **Không có máy chủ thu dữ liệu.** Ảnh, âm thanh, văn bản chỉ nằm trong IndexedDB của máy học sinh.
- **Không tài khoản, không cookie theo dõi, không Google Analytics.** Nếu cần thống kê thì chỉ dùng công cụ không cookie, không định danh, và phải xin phép.
- **Làm mờ khuôn mặt** tùy chọn khi xuất hoặc nộp bài. Có tùy chọn "chỉ nộp đặc trưng, không nộp ảnh gốc".
- Nút **"Xóa toàn bộ dữ liệu trên máy này"** dễ tìm (quan trọng với máy dùng chung ở phòng tin).
- Trang **PRIVACY.md** viết bằng ngôn ngữ dễ hiểu cho học sinh và phụ huynh.
- Tuân thủ quy định pháp luật Việt Nam về bảo vệ dữ liệu cá nhân, đặc biệt dữ liệu của trẻ em. Thiết kế "không thu thập" là cách tuân thủ đơn giản và chắc chắn nhất.

### 7.2. Bảo mật

| Rủi ro | Biện pháp |
|---|---|
| Tệp dự án độc hại | Xác thực Zod; giới hạn kích thước và số tệp; chỉ chấp nhận đúng MIME; không thực thi nội dung |
| XSS qua tên lớp, văn bản, bài học | React tự thoát ký tự; cấm `dangerouslySetInnerHTML` (trừ MDX đã build sẵn); lọc nội dung bằng DOMPurify nếu cần hiển thị HTML |
| Thư viện bên thứ ba bị chèn mã | Ghim phiên bản, lockfile, Dependabot, CodeQL, `npm audit` trong CI; tự lưu trữ mô hình, không tải mã từ CDN |
| Tiêm script | CSP qua `<meta>`: `default-src 'self'`, cấm `eval`, chặn mọi nguồn ngoài |
| Quyền thiết bị | Chỉ xin quyền camera/micro khi người dùng bấm; có đèn báo "đang ghi"; tắt ngay khi rời trang |

### 7.3. Giấy phép

- **Mã nguồn:** MIT hoặc Apache-2.0.
- **Nội dung bài học, giáo án:** CC BY 4.0 (hoặc CC BY-SA 4.0).
- **Mô hình nền:** ghi nguồn và giấy phép gốc (MobileNet, MoveNet đều là Apache-2.0).
- **Bộ dữ liệu mẫu:** chỉ dùng dữ liệu tự thu (có đồng ý) hoặc dữ liệu có giấy phép mở (CC0 / CC BY), ghi nguồn từng bộ trong `datasets/README.md`. **Tuyệt đối không dùng ảnh khuôn mặt học sinh thật.**

---

## 8. Bảo đảm độ tin cậy (khoa học và sư phạm)

Đây là điều kiện để giáo viên dám dùng trên lớp.

1. **Kiểm thử đối chiếu:** mỗi thuật toán tự cài (k-NN, cây, hồi quy, PCA, k-means, TF-IDF, FFT, mel) được kiểm thử bằng **kết quả tham chiếu sinh từ scikit-learn / NumPy / librosa** (`scripts/gen-reference-results.py`), sai số cho phép được ghi rõ.
2. **Nhãn chính xác / xấp xỉ** trên mọi hình trực quan (mục 4.2), kèm nút "ⓘ Hình này được tạo thế nào?" dẫn tới trang giải thích kỹ thuật.
3. **Không phóng đại:** dùng ngôn ngữ chính xác ("mô hình tính ra xác suất…", không dùng "AI hiểu rằng…"). Có bảng **"Những điều AI này KHÔNG làm được"**.
4. **Tái lập được:** seed cố định; nhật ký ghi phiên bản ứng dụng và mô hình nền.
5. **Hội đồng thẩm định nội dung:** ít nhất 1 chuyên gia AI/ML và 2 giáo viên Tin học duyệt mỗi bài học trước khi phát hành. Ghi tên người thẩm định (nếu đồng ý) trong bài.
6. **Thử nghiệm thực tế:** chạy thí điểm ở 2–3 lớp trước khi công bố rộng; đo hiệu quả bằng bài kiểm tra trước và sau (theo chỉ số trong tài liệu đề xuất).
7. **Minh bạch phát triển:** mã nguồn mở, CHANGELOG theo phiên bản ngữ nghĩa (SemVer), có nơi báo lỗi nội dung trên GitHub Issues.

---

## 9. Chất lượng phần mềm

### 9.1. Kiểm thử

| Loại | Công cụ | Phạm vi |
|---|---|---|
| Unit | Vitest | Toàn bộ `core/` (thuật toán, chia dữ liệu, kiểm tra chất lượng, seed RNG, schema), mục tiêu độ phủ ≥ 80% (lõi ML ≥ 90%) |
| Tích hợp | Vitest + Testing Library + TF.js backend CPU | Pipeline đầy đủ với dữ liệu nhỏ; lưu và mở lại dự án; Worker |
| E2E | Playwright (camera giả bằng tệp video) | Luồng chính: tạo dự án → thu dữ liệu → huấn luyện → đánh giá → xuất → mở lại; nộp và chấm bài |
| Hiệu năng | Kiểm thử đo thời gian + Lighthouse CI | Ngân sách dung lượng JS, thời gian huấn luyện trên dữ liệu chuẩn |
| Truy cập | axe-core trong Playwright | Không có lỗi mức nghiêm trọng |
| Trực quan | Ảnh chụp so sánh (Playwright snapshots) | Các biểu đồ và Inspector |

### 9.2. CI/CD (GitHub Actions)

```
Pull request ─► lint (ESLint, Prettier) ─► typecheck ─► unit + tích hợp (độ phủ) ─► build ─► E2E ─► Lighthouse + axe
Merge vào main ─► (tất cả các bước trên) ─► deploy lên GitHub Pages ─► gắn tag phiên bản + CHANGELOG
Hằng tuần ─► Dependabot + CodeQL + npm audit
```

- Nhánh `main` được bảo vệ: phải qua CI và có ít nhất 1 người duyệt.
- Commit theo chuẩn Conventional Commits (`feat:`, `fix:`, `docs:` …).

### 9.3. Truy cập (Accessibility) và trải nghiệm

- Đạt chuẩn **WCAG 2.1 AA**: điều khiển hoàn toàn bằng bàn phím, nhãn cho trình đọc màn hình, độ tương phản đủ.
- **Bảng màu an toàn cho người mù màu.** Lớp phân biệt bằng cả màu lẫn ký hiệu (● ▲ ■).
- Chế độ sáng / tối; cỡ chữ lớn; giao diện dùng được trên máy tính bảng (Studio ảnh và tư thế).
- Tiếng Việt chuẩn, thuật ngữ thống nhất theo Từ điển AI của trang.

---

## 10. Lộ trình phát triển

| Giai đoạn | Thời lượng gợi ý | Sản phẩm | Tiêu chí hoàn thành |
|---|---|---|---|
| **0. Nền móng** | 2–3 tuần | Repo, CI/CD, khung giao diện, i18n, lưu trữ, định dạng `.lup`, trang Giới thiệu và Quyền riêng tư | Deploy được lên GitHub Pages, CI xanh |
| **1. MVP – Studio Ảnh minh bạch** | 6–8 tuần | Dự án ảnh 6 bước; tách Dạy / Kiểm tra; trợ lý chất lượng dữ liệu; Inspector: điểm ảnh, tiền xử lý, vector đặc trưng, bản đồ PCA, giải thích bằng ví dụ, occlusion; huấn luyện chậm có phát lại; ma trận nhầm lẫn bấm được; nhật ký và so sánh; 3 bộ dữ liệu mẫu; 3 bài học. *Bước ⑥ Sử dụng (thử trực tiếp ảnh mới bằng webcam / tệp, chấm ✱ trên bản đồ 2D) bị sót khi đóng giai đoạn, đã bổ sung ngày 25/11/2026.* | Thí điểm được 1 lớp THCS và 1 lớp THPT |
| **2. Mở nắp sâu hơn** | 4–6 tuần | Grad-CAM, bản đồ đặc trưng CNN, chế độ học 2D (ranh giới chính xác), UMAP, đường đi phép tính, ngưỡng tin cậy, PWA ngoại tuyến | Chạy ngoại tuyến được ở phòng máy |
| **3. Sân chơi thuật toán & dữ liệu bảng** | 4–6 tuần | k-NN, cây quyết định, hồi quy, gradient descent, k-means, mạng nơ-ron mini; Studio dữ liệu bảng; xuất notebook Colab | Kiểm thử đối chiếu scikit-learn đạt |
| **4. Âm thanh, tư thế, văn bản tiếng Việt** | 6–8 tuần | 3 Studio còn lại kèm Inspector riêng (ảnh phổ, khung xương, trọng số từ) | |
| **5. Lớp học & đạo đức** | 4–6 tuần | Gói bài tập / bài nộp, bảng chấm, rubric, chế độ trình chiếu; Ethics Lab, thẻ mô hình, làm mờ khuôn mặt (**đã xong**, PR #29–#35) | Một giáo viên tổ chức trọn một bài kiểm tra |
| **6. Khối lệnh & phần cứng** | 4 tuần | Blockly, Web Serial / BLE, firmware mẫu | |
| **7. Hoàn thiện & cộng đồng** | liên tục | Đủ bài học lớp 6–12, giáo án, thẩm định, thí điểm diện rộng, hướng dẫn đóng góp | Phiên bản 1.0 |

> Thời lượng ước tính cho **1–2 người phát triển** làm bán thời gian, có AI hỗ trợ lập trình. Nên **ra MVP sớm** để có phản hồi thật từ lớp học, thay vì làm đủ mọi thứ rồi mới thử.

---

## 11. Rủi ro và cách giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Máy trường quá yếu, huấn luyện chậm hoặc treo | Cao | Chế độ Nhẹ, cache đặc trưng, Worker, benchmark tự chọn cấu hình, thử trên máy thật từ giai đoạn 1 |
| Phạm vi quá lớn, dự án kéo dài | Cao | MVP chỉ làm Studio Ảnh; ưu tiên theo danh sách top 10; mỗi giai đoạn có tiêu chí hoàn thành |
| Hình trực quan gây hiểu sai (đặc biệt UMAP, Grad-CAM) | Trung bình | Nhãn chính xác / xấp xỉ, trang giải thích kỹ thuật, thẩm định của chuyên gia |
| Trình duyệt không hỗ trợ (Safari, máy cũ) | Trung bình | Kiểm tra tính năng khi mở, hiển thị hướng dẫn dùng Chrome/Edge, CPU dự phòng |
| Mất dữ liệu do xóa cache, máy dùng chung | Trung bình | Nhắc xuất `.lup` thường xuyên; tự động nhắc khi rời trang; cảnh báo dung lượng lưu trữ |
| Băng thông GitHub Pages khi nhiều trường dùng | Thấp–TB | Mô hình được PWA cache sau lần tải đầu; có thể nhân bản lên Cloudflare Pages / Netlify |
| Thư viện thay đổi API | Thấp | Ghim phiên bản, kiểm thử tích hợp, nâng cấp có kế hoạch |
| Dữ liệu mẫu vi phạm bản quyền / quyền riêng tư | Thấp | Chỉ dùng dữ liệu tự thu có đồng ý hoặc giấy phép mở, ghi nguồn đầy đủ |

---

## 12. Các quyết định đã chốt (22/11/2026)

| # | Nội dung | Quyết định |
|---|---|---|
| 1 | Tên dự án | **LUP Machine** |
| 2 | Repository | <https://github.com/vantupham/lup-machine> |
| 3 | Địa chỉ web | GitHub Pages: <https://vantupham.github.io/lup-machine/> |
| 4 | Phạm vi MVP | Studio Ảnh minh bạch (giai đoạn 0 → 1) |
| 5 | Khung giao diện | React + TypeScript + Vite |
| 6 | Lớp học trực tuyến | **Không có backend.** Lớp học qua trao đổi tệp (`.lupa` / `.lups`) |
| 7 | Dữ liệu mẫu | Dữ liệu có giấy phép mở (CC0 / CC BY) trước; dữ liệu tự thu (có phiếu đồng ý) bổ sung sau |
| 8 | Thẩm định nội dung | Tối thiểu 1 chuyên gia AI/ML + 2 giáo viên Tin học cho mỗi bài học (danh sách cụ thể bổ sung sau) |

---

## 13. Bước tiếp theo đề xuất

1. Chốt các quyết định ở mục 12.
2. Khởi tạo repo theo cấu trúc mục 6: cấu hình Vite + React + TS, CI/CD, deploy GitHub Pages trống.
3. Viết `core/` cho Studio Ảnh theo hướng **TDD** (seed RNG, chia dữ liệu, kiểm tra chất lượng, PCA, k-NN, đầu Dense).
4. Dựng giao diện 6 bước và 3 công cụ Inspector đầu tiên (điểm ảnh, vector đặc trưng, bản đồ PCA).
5. Thí điểm nội bộ trên máy phòng tin thật, rồi điều chỉnh trước khi làm tiếp giai đoạn 2.
