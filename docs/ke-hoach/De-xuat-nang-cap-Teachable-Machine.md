# Đề xuất nâng cấp Teachable Machine cho giảng dạy AI cấp THCS và THPT

> Tài liệu nối tiếp [Danh-gia-Teachable-Machine.md](Danh-gia-Teachable-Machine.md).
> Mục tiêu: biến Teachable Machine từ công cụ "bấm là chạy" thành **phòng thí nghiệm AI minh bạch**. Ở đó học sinh không chỉ thấy *kết quả* mà còn thấy **AI đã làm gì, làm thế nào và vì sao lại đúng hoặc sai**.
> Ngày lập: 22/11/2026

---

## 1. Vấn đề cần giải quyết

| # | Hạn chế hiện tại | Hệ quả với việc học |
|---|---|---|
| 1 | Quá trình huấn luyện là một thanh tiến trình | Học sinh không biết "huấn luyện" thực chất là gì |
| 2 | Không thấy mô hình "nhìn" vào đâu | Học sinh nghĩ AI "hiểu" giống con người |
| 3 | Không kiểm soát tập huấn luyện và tập kiểm tra | Hình thành thói quen đánh giá sai, "ảo tưởng" độ chính xác |
| 4 | Chỉ có bài toán phân loại | Hiểu hẹp rằng "AI = phân loại ảnh" |
| 5 | Không so sánh được các lần thử | Không rèn được tư duy thực nghiệm khoa học |
| 6 | Giao diện tiếng Anh, thuật ngữ khó | Học sinh THCS bị rào cản ngôn ngữ |
| 7 | Không có công cụ cho lớp học | Giáo viên khó giao bài, theo dõi, đánh giá |
| 8 | Đạo đức AI chỉ dạy được nếu giáo viên tự thiết kế | Thiếu hoạt động có cấu trúc về thiên lệch và quyền riêng tư |

---

## 2. Nguyên tắc thiết kế

1. **Minh bạch từng bước (Glass-box):** mọi bước trong quy trình AI đều có thể "mở nắp" để xem bên trong.
2. **Hai chế độ theo cấp học:**
   - 🟢 **Chế độ Khám phá (THCS):** trực quan, ẩn dụ, ít số liệu.
   - 🔵 **Chế độ Chuyên sâu (THPT):** có số liệu, công thức đơn giản, xuất mã nguồn.
3. **Dự đoán trước, kiểm chứng sau:** trước mỗi thao tác quan trọng, hệ thống hỏi học sinh *"Em nghĩ điều gì sẽ xảy ra?"*, rồi đối chiếu với kết quả thật.
4. **Lỗi là cơ hội học:** khi mô hình sai, hệ thống hướng dẫn tìm nguyên nhân chứ không chỉ báo "sai".
5. **Riêng tư mặc định:** dữ liệu ở lại trên máy, khuôn mặt được làm mờ khi chia sẻ.
6. **Tiếng Việt hoàn toàn,** có giải thích thuật ngữ ngay tại chỗ.

---

## 3. Nhóm tính năng đề xuất

Ký hiệu mức ưu tiên: ⭐⭐⭐ cần thiết nhất · ⭐⭐ quan trọng · ⭐ mở rộng
Ký hiệu cấp học: 🟢 THCS · 🔵 THPT

### Nhóm A. "Mở nắp" mô hình – AI thực sự làm gì?

Đây là nhóm **cốt lõi** để học sinh hiểu bản chất AI.

#### A1. Sơ đồ quy trình tương tác ⭐⭐⭐ 🟢🔵

Thay ba ô *Gather – Train – Export* bằng một **dòng chảy có thể bấm vào từng bước**:

```
 [📷 Ảnh đầu vào] → [🔲 Thu nhỏ 224×224] → [🧠 Trích đặc trưng] → [📊 Lớp phân loại] → [✅ Kết quả]
       ↓                   ↓                      ↓                     ↓                  ↓
   (bấm để xem)       ma trận điểm ảnh      1024 con số mô tả      trọng số học được    xác suất từng lớp
```

- 🟢 THCS: mỗi bước có hình minh họa và câu giải thích một dòng, ví dụ *"Máy tính chỉ thấy ảnh là một bảng các con số màu"*.
- 🔵 THPT: hiển thị kích thước tensor, số tham số và tên mô hình nền (MobileNet).

#### A2. "Máy tính nhìn thấy gì?" – Chế độ xem điểm ảnh ⭐⭐⭐ 🟢

- Phóng to một vùng ảnh để thấy các ô vuông và giá trị RGB.
- Thanh trượt chuyển dần từ "ảnh như người nhìn" sang "lưới số như máy nhìn".
- Mục đích: phá bỏ ngộ nhận "máy tính nhìn giống người".

#### A3. Bản đồ chú ý (Heatmap / Grad-CAM) ⭐⭐⭐ 🟢🔵

- Phủ lớp màu lên ảnh để chỉ vùng mô hình **dựa vào nhiều nhất** khi đưa ra quyết định.
- Ví dụ: mô hình "nhận diện quả táo" nhưng heatmap lại sáng ở **mặt bàn phía sau**. Học sinh tự phát hiện mô hình đang "học lối tắt".
- Với dự án âm thanh: tô màu vùng nào trên **ảnh phổ (spectrogram)** quan trọng.
- Với dự án tư thế: tô màu khớp xương nào ảnh hưởng nhiều nhất.

#### A4. Bản đồ đặc trưng 2D (Embedding map) ⭐⭐⭐ 🔵 (🟢 bản đơn giản)

- Chiếu mọi mẫu dữ liệu lên mặt phẳng 2D (bằng PCA hoặc t-SNE). Mỗi chấm là một ảnh, mỗi màu là một lớp.
- Học sinh **thấy** các lớp tách nhau rõ (mô hình sẽ tốt) hoặc chồng lên nhau (mô hình sẽ dễ nhầm).
- Ảnh đang thử trên webcam hiện thành một **chấm nhấp nháy di chuyển** trên bản đồ, giúp hiểu trực quan "phân loại là xem chấm rơi vào vùng nào".
- Bấm vào một chấm để xem ảnh gốc, từ đó phát hiện ảnh dán nhãn sai hoặc ảnh lạc loài.

```
   Bản đồ đặc trưng
   ┌───────────────────────────┐
   │   ● ●●                    │   ● Mèo
   │  ●●●●●        ▲ ▲         │   ▲ Chó
   │   ●●●  ▲     ▲▲▲▲▲        │   ✱ Ảnh webcam hiện tại
   │         ●   ▲▲▲✱▲         │
   │               ▲▲          │   ⚠ 2 ảnh "Mèo" nằm giữa vùng "Chó"
   └───────────────────────────┘     → bấm để kiểm tra
```

#### A5. "Vì sao lại đoán như vậy?" – Giải thích bằng ví dụ ⭐⭐ 🟢🔵

- Với mỗi dự đoán, hiển thị **3 ảnh huấn luyện giống nhất** (láng giềng gần nhất).
- Câu giải thích tự động: *"Mô hình đoán **Chó** (87%) vì ảnh này giống nhất với 3 ảnh em đã dạy trong lớp Chó."*
- Đây là cách giải thích dễ hiểu nhất cho học sinh THCS.

#### A6. Mô phỏng quá trình huấn luyện từng bước ⭐⭐⭐ 🔵 (🟢 bản hoạt hình)

- **Chế độ chậm (Slow-motion):** huấn luyện từng epoch, có nút ⏸ tạm dừng và ⏭ bước tiếp.
- Ở mỗi bước, hiển thị:
  - Đường **ranh giới quyết định** dịch chuyển dần trên bản đồ 2D (A4).
  - Đồ thị **loss giảm** và **accuracy tăng** theo thời gian thực.
  - Một vài mẫu chuyển từ "đoán sai" (đỏ) sang "đoán đúng" (xanh).
- 🟢 THCS: ẩn dụ *"Máy đoán → so với đáp án → sửa lỗi → đoán lại"*, có nhân vật hoạt hình.
- 🔵 THPT: giải thích khái niệm **hàm mất mát**, **gradient descent**, **learning rate** bằng hình ảnh "lăn xuống thung lũng".

#### A7. Xem bên trong mạng nơ-ron (Neuron viewer) ⭐ 🔵

- Hiển thị các bản đồ đặc trưng (feature map) ở vài tầng của mạng tích chập (CNN): tầng đầu phát hiện cạnh, tầng giữa phát hiện họa tiết, tầng sau phát hiện bộ phận.
- Có lớp phân loại cuối dạng sơ đồ nơ-ron với độ dày đường nối thể hiện trọng số.

---

### Nhóm B. Dữ liệu – "AI giỏi hay dở là do dữ liệu"

#### B1. Tách tập Huấn luyện / Kiểm tra rõ ràng ⭐⭐⭐ 🟢🔵

- Mỗi lớp có 2 ngăn: **📚 Dạy** và **📝 Kiểm tra**. Học sinh tự kéo thả ảnh hoặc chọn tự động chia 80/20.
- Sau huấn luyện, hiển thị **2 điểm số riêng**: "Điểm trên bài đã học" và "Điểm trên bài chưa học".
- Cảnh báo khi chênh lệch lớn: *"⚠ Mô hình thuộc bài nhưng chưa hiểu bài (quá khớp)"*.

#### B2. Trợ lý kiểm tra chất lượng dữ liệu ⭐⭐⭐ 🟢🔵

Tự động phát hiện và gợi ý:

| Vấn đề | Thông báo cho học sinh |
|---|---|
| Lớp mất cân bằng | "Lớp Mèo có 120 ảnh, lớp Chó chỉ có 15 ảnh. Mô hình sẽ thiên về Mèo." |
| Ảnh trùng lặp | "Có 30 ảnh gần như giống hệt nhau, không giúp mô hình học thêm." |
| Nền giống nhau | "Toàn bộ ảnh lớp A có cùng nền. Mô hình có thể học nền thay vì đồ vật." |
| Ảnh mờ, tối | "8 ảnh quá tối, nên chụp lại." |
| Nghi dán nhãn sai | "Ảnh này giống lớp Chó hơn lớp Mèo, em kiểm tra lại nhé." |
| Thiếu đa dạng | "Thử chụp thêm ở góc khác, ánh sáng khác, người khác." |

#### B3. Phòng thí nghiệm tăng cường dữ liệu (Data augmentation) ⭐⭐ 🔵

- Bật/tắt các phép biến đổi: xoay, lật, thay đổi độ sáng, cắt, thêm nhiễu. Xem trước ảnh sinh ra.
- So sánh mô hình **có và không có** tăng cường dữ liệu trên tập kiểm tra.

#### B4. Thí nghiệm "nhãn nhiễu" ⭐⭐ 🔵

- Thanh trượt "Dán nhãn sai ngẫu nhiên 0% → 50%", rồi quan sát độ chính xác giảm dần.
- Giúp học sinh hiểu vai trò của việc gán nhãn cẩn thận, và vì sao có nghề *gán nhãn dữ liệu*.

#### B5. Thư viện bộ dữ liệu mẫu tiếng Việt ⭐⭐⭐ 🟢🔵

- Bộ dữ liệu sẵn gắn với bối cảnh Việt Nam: lá cây thuốc nam, các loại rác sinh hoạt, trái cây Việt, tiền Việt Nam, biển báo giao thông, tiếng chim, nhạc cụ dân tộc, thanh điệu tiếng Việt.
- Dùng được cho phòng máy **không có webcam/micro**.
- Có các **bộ dữ liệu "bẫy"** cài sẵn thiên lệch, dùng cho bài học đạo đức AI.

---

### Nhóm C. Thực nghiệm khoa học – Học như nhà nghiên cứu

#### C1. Nhật ký thí nghiệm và so sánh các lần chạy ⭐⭐⭐ 🟢🔵

- Mỗi lần huấn luyện được lưu thành một **phiên bản** với cấu hình, số mẫu và kết quả.
- Bảng so sánh song song, có thể vẽ đồ thị:

```
 Lần │ Số ảnh/lớp │ Epoch │ Tăng cường │ Điểm học │ Điểm kiểm tra
 ────┼────────────┼───────┼────────────┼──────────┼──────────────
  1  │     10     │  50   │    Tắt     │   100%   │     62%
  2  │     50     │  50   │    Tắt     │    98%   │     81%
  3  │     50     │  50   │    Bật     │    95%   │     89%  ← tốt nhất
```

- Học sinh rút ra kết luận dựa trên bằng chứng, đúng phương pháp khoa học.

#### C2. Phiếu thí nghiệm có hướng dẫn ⭐⭐ 🟢🔵

- Khung: *Câu hỏi → Giả thuyết → Thay đổi một biến → Kết quả → Kết luận*.
- Ví dụ câu hỏi: "Tăng số ảnh có luôn làm mô hình tốt hơn không?", "Learning rate quá lớn thì sao?".
- Xuất phiếu thành PDF để nộp bài.

#### C3. Ma trận nhầm lẫn "có thể bấm" ⭐⭐⭐ 🟢🔵

- Bấm vào một ô (ví dụ "thật là Mèo, đoán là Chó") để hiện **chính các ảnh bị nhầm**.
- 🔵 THPT: hiển thị thêm Precision, Recall, F1, kèm giải thích bằng ví dụ đời thường (xét nghiệm bệnh, lọc thư rác).

#### C4. Thanh trượt ngưỡng tin cậy ⭐⭐ 🔵

- Đặt ngưỡng: chỉ chấp nhận dự đoán khi độ tin cậy ≥ X%, còn lại trả lời *"Không chắc chắn"*.
- Thấy sự đánh đổi giữa "đoán nhiều nhưng hay sai" và "đoán ít nhưng chắc".
- Thêm lớp **"Không thuộc lớp nào"** để dạy rằng mô hình luôn buộc phải chọn một trong các lớp đã học.

---

### Nhóm D. Mở rộng loại bài toán – AI không chỉ là phân loại

| Mã | Tính năng | Ưu tiên | Cấp | Ý nghĩa học tập |
|---|---|---|---|---|
| D1 | **Phân loại văn bản tiếng Việt** (cảm xúc bình luận, chủ đề tin tức, lọc tin rác) | ⭐⭐⭐ | 🟢🔵 | AI xử lý ngôn ngữ, gần với chatbot |
| D2 | **Dữ liệu bảng / số** (dự đoán điểm thi, giá nhà, loại hoa Iris) | ⭐⭐ | 🔵 | Hồi quy, khoa học dữ liệu, gắn với Toán |
| D3 | **Phát hiện đối tượng** (vẽ khung bao, đếm vật thể) | ⭐⭐ | 🔵 | Khác biệt giữa phân loại và định vị |
| D4 | **Phân cụm không giám sát** (tự nhóm ảnh khi không có nhãn) | ⭐⭐ | 🔵 | Học có giám sát và không giám sát |
| D5 | **So sánh thuật toán:** k-NN, cây quyết định, mạng nơ-ron trên cùng dữ liệu | ⭐⭐ | 🔵 | Không có thuật toán "tốt nhất cho mọi bài" |
| D6 | **Cây quyết định trực quan** có thể tự vẽ và xem máy vẽ | ⭐⭐ | 🟢🔵 | Mô hình dễ giải thích, gắn với tư duy logic |
| D7 | **Học tăng cường mini** (dạy nhân vật đi mê cung bằng thưởng/phạt) | ⭐ | 🟢🔵 | Loại học máy thứ ba |
| D8 | **Góc AI tạo sinh** (mô hình nhỏ sinh chữ/ảnh đơn giản, minh họa "dự đoán từ tiếp theo") | ⭐ | 🔵 | Hiểu cơ bản cách ChatGPT hoạt động, phân biệt với phân loại |
| D9 | **Cảm biến** (gia tốc kế điện thoại, micro:bit) để nhận diện chuyển động | ⭐ | 🟢🔵 | AI trong IoT và thiết bị đeo |

---

### Nhóm E. Từ không lập trình đến lập trình

#### E1. Lập trình khối tích hợp sẵn ⭐⭐⭐ 🟢

- Có sẵn khối lệnh kiểu Scratch ngay trong công cụ, không cần cài extension: `khi mô hình nhận ra [Mèo] với độ tin cậy > [80]% thì ...`.
- Có mẫu trò chơi: điều khiển nhân vật bằng cử chỉ, đèn giao thông bằng giọng nói, thùng rác thông minh.

#### E2. "Xem mã" song song ⭐⭐⭐ 🔵

- Mỗi thao tác giao diện (thêm lớp, huấn luyện, dự đoán) đều hiện **đoạn mã Python/Keras tương đương**, có chú thích tiếng Việt.
- Nút **"Mở trong Google Colab"** xuất toàn bộ dự án và dữ liệu thành notebook chạy được.
- Học sinh thấy rõ cầu nối: *giao diện kéo thả = những dòng lệnh này*.

#### E3. Kết nối phần cứng một chạm ⭐⭐ 🟢🔵

- Kết nối trực tiếp micro:bit, Arduino, ESP32, Yolo:Bit qua Web Serial / Web Bluetooth.
- Ánh xạ "lớp → hành động" bằng giao diện, ví dụ: lớp *Nhựa* → servo quay trái.

---

### Nhóm F. Đạo đức AI và AI có trách nhiệm

#### F1. Phòng thí nghiệm thiên lệch (Bias Lab) ⭐⭐⭐ 🟢🔵

- Kịch bản có hướng dẫn: học sinh dùng bộ dữ liệu bị lệch (ví dụ chỉ toàn ảnh người da sáng, hoặc chỉ một giống chó), quan sát mô hình hoạt động kém với nhóm thiểu số, rồi sửa dữ liệu và đo lại.
- 🔵 THPT: đo **độ chính xác theo từng nhóm con** để thấy sự bất công dù độ chính xác tổng vẫn cao.

#### F2. Thẻ mô hình (Model card) ⭐⭐ 🟢🔵

- Bắt buộc điền trước khi chia sẻ: *Mô hình làm gì? Dữ liệu lấy từ đâu? Hoạt động tốt và kém trong trường hợp nào? Ai có thể bị ảnh hưởng?*
- Rèn thói quen minh bạch và có trách nhiệm.

#### F3. Bảo vệ quyền riêng tư ⭐⭐⭐ 🟢🔵

- **Tự động làm mờ khuôn mặt** khi chia sẻ dự án (trừ dự án tư thế, chỉ lưu khung xương).
- Chế độ **"Chỉ trên máy"**, cấm upload, do giáo viên bật cho cả lớp.
- Biểu tượng hiển thị rõ dữ liệu đang **nằm ở đâu** (trên máy / trên đám mây).
- Bài học ngắn: *"Ảnh em đưa cho AI đi đâu?"*

#### F4. Tình huống đạo đức tương tác ⭐ 🟢🔵

- Các tình huống gắn với dự án vừa làm, ví dụ: *"Nếu mô hình phân loại rác này dùng ở trường, khi nó sai thì ai chịu trách nhiệm?"*
- Học sinh bình chọn và thảo luận; giáo viên xem tổng hợp ý kiến.

---

### Nhóm G. Trải nghiệm học tập và ngôn ngữ

| Mã | Tính năng | Ưu tiên | Cấp | Mô tả |
|---|---|---|---|---|
| G1 | **Việt hóa toàn bộ** | ⭐⭐⭐ | 🟢🔵 | Giao diện, thông báo, hướng dẫn; giữ thuật ngữ gốc trong ngoặc |
| G2 | **Giải thích thuật ngữ khi rê chuột** | ⭐⭐⭐ | 🟢🔵 | Ví dụ *Epoch*: "Một lượt máy học hết toàn bộ ảnh một lần, giống đọc hết sách một lượt" |
| G3 | **Nhiệm vụ có hướng dẫn (Missions)** | ⭐⭐⭐ | 🟢 | Chuỗi thử thách theo cấp độ, có huy hiệu, mỗi nhiệm vụ gắn một khái niệm |
| G4 | **Câu hỏi "Dự đoán trước"** | ⭐⭐ | 🟢🔵 | Trước khi huấn luyện: "Em đoán mô hình đạt bao nhiêu %?", sau đó so sánh |
| G5 | **Trợ lý AI giải thích** | ⭐⭐ | 🟢🔵 | Học sinh hỏi "Vì sao mô hình của em hay nhầm?"; trợ lý phân tích dữ liệu và kết quả của chính dự án đó để trả lời |
| G6 | **Câu hỏi kiểm tra nhanh** sau mỗi bước | ⭐⭐ | 🟢🔵 | 2–3 câu trắc nghiệm củng cố khái niệm |
| G7 | **Chế độ trình chiếu cho giáo viên** | ⭐⭐ | 🟢🔵 | Phóng to, ẩn chi tiết phụ, dùng để minh họa trên máy chiếu |
| G8 | **Hoạt động không dùng máy tính đi kèm** | ⭐ | 🟢 | Thẻ bài in sẵn mô phỏng "người làm mô hình" trước khi dùng máy |

---

### Nhóm H. Công cụ cho giáo viên và nhà trường

#### H1. Lớp học và giao bài ⭐⭐⭐

- Tạo lớp bằng mã tham gia, không bắt học sinh dùng email cá nhân (phù hợp học sinh dưới 13 tuổi).
- Giao dự án mẫu kèm dữ liệu, hạn nộp và tiêu chí đánh giá.

#### H2. Bảng theo dõi tiến độ ⭐⭐

- Xem học sinh đang ở bước nào, đã huấn luyện mấy lần, kết quả trên tập kiểm tra.
- Phát hiện học sinh gặp khó: huấn luyện nhiều lần mà kết quả không cải thiện.

#### H3. Đánh giá theo năng lực ⭐⭐

- Rubric mẫu chấm theo: thiết kế dữ liệu, phương pháp kiểm thử, giải thích lỗi, thẻ mô hình, ý thức đạo đức.
- Xuất báo cáo điểm ra Excel.

#### H4. Kho giáo án mẫu ⭐⭐⭐

- Giáo án theo chủ đề, có sẵn dữ liệu, phiếu học tập và câu hỏi.
- Gắn với nội dung về học máy và AI trong chương trình Tin học phổ thông.

#### H5. Chạy ngoại tuyến (Offline/PWA) ⭐⭐

- Cài như ứng dụng, tải sẵn mô hình nền, dùng được khi phòng máy mất mạng hoặc mạng yếu.
- Có máy chủ nội bộ (LAN) để chia sẻ dự án trong lớp mà không cần Internet.

---

## 4. Ví dụ trải nghiệm hoàn chỉnh

**Bài học: "Thùng rác thông minh" (lớp 8, 2 tiết)**

| Bước | Học sinh làm | Tính năng hỗ trợ | Khái niệm học được |
|---|---|---|---|
| 1 | Xem "máy tính nhìn thấy gì" | A2 | Ảnh là dữ liệu số |
| 2 | Dự đoán: cần bao nhiêu ảnh? | G4 | Hình thành giả thuyết |
| 3 | Thu thập ảnh 3 lớp: Nhựa, Giấy, Hữu cơ | B5, B2 | Thu thập và gán nhãn dữ liệu |
| 4 | Trợ lý báo "lớp Giấy toàn nền bàn gỗ" | B2 | Chất lượng dữ liệu |
| 5 | Huấn luyện chế độ chậm, xem ranh giới dịch chuyển | A6 | Huấn luyện là quá trình sửa lỗi lặp lại |
| 6 | Kiểm tra trên tập riêng: 72% | B1 | Đánh giá khách quan |
| 7 | Bấm ma trận nhầm lẫn, thấy Giấy hay bị nhầm thành Nhựa | C3 | Phân tích lỗi |
| 8 | Heatmap cho thấy mô hình nhìn vào nền bàn | A3 | Học lối tắt |
| 9 | Chụp thêm ảnh đa dạng, huấn luyện lại: 90% | C1 | Cải thiện dựa trên bằng chứng |
| 10 | Viết thẻ mô hình: "Chưa nhận ra được rác ướt" | F2 | Giới hạn và trách nhiệm |
| 11 | Kéo khối lệnh điều khiển servo micro:bit | E1, E3 | Ứng dụng thực tế |

**Kết quả:** học sinh không chỉ "làm được" mà **giải thích được** vì sao mô hình sai, và đã sửa nó như thế nào.

---

## 5. Lộ trình gợi ý theo cấp học

| Cấp | Trọng tâm | Tính năng chính |
|---|---|---|
| **Lớp 6–7** | AI học từ ví dụ; dữ liệu quan trọng | A1, A2, A5, B5, E1, G1–G3 |
| **Lớp 8–9** | Huấn luyện, kiểm thử, thiên lệch | A3, A6 (hoạt hình), B1, B2, C1, C3, F1, F3 |
| **Lớp 10** | Các loại học máy; đánh giá mô hình | A4, A6, C3, C4, D1, D4, D6 |
| **Lớp 11** | Thuật toán, tham số, dữ liệu số | B3, B4, C2, D2, D5, E2 |
| **Lớp 12** | Mạng nơ-ron, AI tạo sinh, triển khai, đạo đức | A7, D3, D8, E2, E3, F2, F4 |

---

## 6. Lộ trình triển khai đề xuất

| Giai đoạn | Thời gian | Nội dung | Tính năng |
|---|---|---|---|
| **1 – Nền tảng** | 0–4 tháng | Việt hóa, tách tập kiểm tra, ma trận bấm được, trợ lý chất lượng dữ liệu, bộ dữ liệu mẫu | G1, G2, B1, B2, B5, C3, F3 |
| **2 – Minh bạch** | 4–8 tháng | Sơ đồ quy trình, heatmap, bản đồ 2D, giải thích bằng ví dụ, huấn luyện chế độ chậm, nhật ký thí nghiệm | A1–A6, C1 |
| **3 – Lớp học** | 8–12 tháng | Lớp học, theo dõi tiến độ, giáo án mẫu, khối lệnh tích hợp, chạy ngoại tuyến | H1–H5, E1, G3 |
| **4 – Mở rộng** | 12–18 tháng | Văn bản tiếng Việt, dữ liệu bảng, so sánh thuật toán, xem mã/Colab, Bias Lab, phần cứng | D1, D2, D5, D6, E2, E3, F1, F2 |
| **5 – Nâng cao** | 18+ tháng | Phát hiện đối tượng, phân cụm, học tăng cường, AI tạo sinh, trợ lý AI | D3, D4, D7, D8, G5, A7 |

**Gợi ý kỹ thuật:** toàn bộ có thể xây trên **TensorFlow.js** chạy phía trình duyệt, giữ nguyên ưu điểm riêng tư:

- Grad-CAM, PCA, t-SNE (UMAP-js) và k-NN đều có thư viện JavaScript.
- Nên thay mô hình nền bằng phiên bản mới hơn: MobileNetV3 hoặc EfficientNet-Lite cho ảnh, MoveNet cho tư thế.
- Phân loại văn bản tiếng Việt có thể dùng mô hình nhúng câu đa ngôn ngữ cỡ nhỏ.

---

## 7. Chỉ số đo hiệu quả

| Chỉ số | Cách đo | Mục tiêu |
|---|---|---|
| Hiểu khái niệm | Bài kiểm tra trước và sau khi học (dữ liệu, huấn luyện, quá khớp, thiên lệch) | Tăng ≥ 30% |
| Giải thích được lỗi | Tỉ lệ học sinh chỉ ra đúng nguyên nhân mô hình sai | ≥ 70% |
| Thói quen kiểm thử | Tỉ lệ dự án có dùng tập kiểm tra riêng | ≥ 80% |
| Nhận thức đạo đức | Tỉ lệ thẻ mô hình nêu được giới hạn hoặc rủi ro | ≥ 70% |
| Hứng thú | Khảo sát thang 5 mức | ≥ 4/5 |
| Mức độ sử dụng của giáo viên | Số tiết dùng công cụ mỗi học kỳ | ≥ 4 tiết/lớp |

---

## 8. Tóm tắt 10 tính năng quan trọng nhất

1. **Việt hóa và giải thích thuật ngữ tại chỗ** (G1, G2)
2. **Tách tập Huấn luyện / Kiểm tra**, có cảnh báo quá khớp (B1)
3. **Heatmap: mô hình nhìn vào đâu** (A3)
4. **Bản đồ đặc trưng 2D**, có chấm webcam di chuyển (A4)
5. **Huấn luyện chế độ chậm**, thấy ranh giới quyết định dịch chuyển (A6)
6. **Trợ lý kiểm tra chất lượng dữ liệu** (B2)
7. **Ma trận nhầm lẫn bấm được** để xem ảnh bị nhầm (C3)
8. **Nhật ký và so sánh các lần thí nghiệm** (C1)
9. **Bias Lab và bảo vệ quyền riêng tư** (F1, F3)
10. **Lớp học, giáo án mẫu, khối lệnh tích hợp** (H1, H4, E1)

> **Thông điệp cốt lõi:** Một công cụ dạy AI tốt không chỉ giúp học sinh *làm ra* mô hình, mà phải giúp các em *nhìn thấy, đo lường, giải thích và chịu trách nhiệm* về mô hình đó.
