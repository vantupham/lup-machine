# Rà soát và đánh giá Google Teachable Machine

> Đánh giá công cụ dưới góc nhìn của **chuyên gia**, **giáo viên**, **học sinh** và **người sử dụng nói chung**.
> Ngày lập: 22/11/2026 · Địa chỉ công cụ: <https://teachablemachine.withgoogle.com>

---

## 1. Tổng quan hệ thống

**Teachable Machine (TM)** là công cụ web miễn phí của Google Creative Lab. Người dùng tự huấn luyện mô hình học máy (machine learning) **ngay trên trình duyệt**, không cần viết mã.

| Mốc | Nội dung |
|---|---|
| 2017 | Phiên bản 1: bản thử nghiệm, huấn luyện bằng webcam với 3 lớp cố định, không xuất được mô hình |
| 11/2019 | Phiên bản 2.0: có 3 loại dự án (ảnh, âm thanh, tư thế), xuất mô hình ra nhiều định dạng, lưu dự án lên Google Drive |
| 2020 | Nhóm phát triển công bố bài báo tại hội nghị CHI 2020 (Carney và cộng sự) |

### 1.1. Quy trình 3 bước

1. **Thu thập (Gather):** tạo các lớp (class), thêm mẫu bằng webcam/micro hoặc tải tệp lên.
2. **Huấn luyện (Train):** bấm *Train Model*, mô hình được huấn luyện ngay trong trình duyệt.
3. **Xuất (Export):** thử mô hình trực tiếp (*Preview*), rồi xuất hoặc tải lên để dùng trong ứng dụng khác.

### 1.2. Các loại dự án

| Loại | Mô hình nền (transfer learning) | Đầu vào | Ứng dụng tiêu biểu |
|---|---|---|---|
| Ảnh (Image) | MobileNet | Webcam, tệp ảnh (thu về 224×224) | Phân loại rác, nhận diện đồ vật, cử chỉ tay |
| Âm thanh (Audio) | Speech Commands | Micro, đoạn âm khoảng 1 giây. Bắt buộc có lớp *Background Noise* | Nhận diện lệnh nói, tiếng vỗ tay, tiếng nhạc cụ |
| Tư thế (Pose) | PoseNet | Webcam, ảnh | Nhận diện động tác thể dục, yoga, ngồi sai tư thế |

### 1.3. Kỹ thuật bên dưới

- **TensorFlow.js:** huấn luyện và suy luận (inference) chạy phía máy khách, dùng WebGL.
- **Học chuyển giao (transfer learning):** giữ nguyên mô hình đã huấn luyện sẵn và chỉ huấn luyện lớp phân loại cuối. Vì vậy chỉ cần vài chục mẫu là đạt kết quả chấp nhận được, và thời gian huấn luyện tính bằng giây.
- **Tùy chọn nâng cao:** số epoch (mặc định 50), batch size (16), learning rate (0,001).
- **"Under the hood":** xem độ chính xác theo lớp, ma trận nhầm lẫn (confusion matrix), đồ thị accuracy/loss theo epoch.
- **Định dạng xuất:**
  - TensorFlow.js: tải về hoặc upload lên máy chủ Google để lấy link chia sẻ.
  - TensorFlow: Keras `.h5`, SavedModel.
  - TensorFlow Lite: float, quantized, Edge TPU (Coral).
  - Có mã mẫu cho p5.js / ml5.js, JavaScript, Android, Python.

### 1.4. Hệ sinh thái tích hợp

- **Lập trình khối:** các extension cộng đồng cho Scratch như ML2Scratch, Stretch3, TM2Scratch. PictoBlox, mBlock và một số nền tảng STEM khác cũng hỗ trợ nhập mô hình TM.
- **Phần cứng:** Arduino (qua TFLite Micro / Serial), micro:bit (qua cầu nối Scratch hoặc ứng dụng trung gian), Raspberry Pi, Coral Edge TPU.
- **Học liệu:** chuỗi bài của *The Coding Train* (Daniel Shiffman, ml5.js); giáo trình đạo đức AI cho THCS của MIT Media Lab (Blakeley Payne, 2019), trong đó có hoạt động dùng TM để minh họa thiên lệch dữ liệu; các chương trình như *Day of AI*, *AI4K12*, *Experiments with Google*.

---

## 2. Góc nhìn chuyên gia (AI / ML, công nghệ giáo dục)

### 2.1. Điểm mạnh

| Tiêu chí | Nhận định |
|---|---|
| **Thiết kế sư phạm** | Đây là ví dụ kinh điển của triết lý *"low floor, high ceiling"*: người mới vào học dễ, người giỏi vẫn có thể xuất mô hình để làm sản phẩm thật. |
| **Đúng bản chất ML** | Thể hiện đầy đủ vòng đời *dữ liệu → huấn luyện → đánh giá → triển khai*. Người học thấy ngay rằng **dữ liệu quyết định mô hình**. |
| **Quyền riêng tư theo thiết kế** | Dữ liệu ảnh và âm thanh mặc định không rời khỏi máy (on-device training). Đây là lợi thế lớn khi dùng với trẻ vị thành niên. |
| **Hạ tầng tối giản** | Không cần cài đặt, không cần GPU riêng, không cần tài khoản để huấn luyện. |
| **Tính mở** | Xuất được mô hình chuẩn TensorFlow, có thể đưa vào mã nguồn, thiết bị nhúng hoặc ứng dụng di động. |
| **Tương tác thời gian thực** | Bản xem trước (preview) cho phản hồi tức thì, giúp người học hình thành trực giác về khái quát hóa (generalization) và quá khớp (overfitting). |

### 2.2. Hạn chế và lưu ý chuyên môn

1. **Chỉ có bài toán phân loại (classification).** Không có phát hiện đối tượng (object detection), phân đoạn (segmentation), hồi quy (regression), phân cụm (clustering) hay mô hình sinh (generative). Người học dễ hiểu sai rằng "AI = phân loại".
2. **"Hộp đen" ở tầng đặc trưng.** Học chuyển giao che đi phần trích xuất đặc trưng. TM không có công cụ giải thích (saliency map, Grad-CAM), nên người học không biết mô hình "nhìn" vào đâu.
3. **Không tách tập kiểm tra rõ ràng.** TM tự lấy khoảng 15% làm tập kiểm định (validation), nhưng người dùng không kiểm soát được việc chia dữ liệu. Thói quen phổ biến là "thử trước webcam thấy đúng là xong", dễ dẫn tới đánh giá quá lạc quan.
4. **Dễ học "lối tắt" (shortcut learning).** Mô hình thường học theo nền, ánh sáng, quần áo thay vì đối tượng chính. Đây vừa là hạn chế vừa là **cơ hội dạy học** (xem mục 3.3).
5. **Khó tái lập kết quả.** Không có seed cố định và không quản lý phiên bản dữ liệu, nên cùng dữ liệu có thể cho kết quả khác nhau giữa các lần huấn luyện.
6. **Giới hạn quy mô.** Huấn luyện trên trình duyệt sẽ chậm hoặc treo khi có hàng nghìn ảnh hoặc máy yếu. Ảnh bị thu về 224×224 nên mất chi tiết nhỏ.
7. **Mô hình nền đã cũ.** MobileNet v1/v2, PoseNet và Speech Commands đều là thế hệ 2017–2019. Độ chính xác thấp hơn các mô hình hiện đại (MoveNet, EfficientNet, ViT…).
8. **Rủi ro khi chia sẻ mô hình.** Mô hình *upload* lên máy chủ Google sẽ công khai với bất kỳ ai có link. Dự án lưu trên Google Drive chứa toàn bộ dữ liệu huấn luyện, gồm cả ảnh khuôn mặt.
9. **Phụ thuộc nhà cung cấp.** Đây là sản phẩm thử nghiệm của Google Creative Lab, không có cam kết duy trì dài hạn (SLA) và nhịp cập nhật tính năng chậm từ sau 2020.

### 2.3. Kết luận của chuyên gia

> TM là **công cụ nhập môn ML xuất sắc nhất trong nhóm "no-code"** xét về độ dễ dùng và quyền riêng tư. Tuy nhiên nó **không thay thế** được việc học ML bài bản. Nên coi TM là "cửa ngõ", sau đó chuyển sang Python, Colab, Keras hoặc các nền tảng như Edge Impulse, Roboflow khi cần sâu hơn.

---

## 3. Góc nhìn giáo viên

### 3.1. Lợi ích khi dạy học

- **Chuẩn bị nhanh:** một tiết học 45 phút đủ để học sinh tự huấn luyện và trình diễn một mô hình.
- **Thiết bị tối thiểu:** máy tính có webcam và trình duyệt Chrome/Edge. Phù hợp phòng máy trường phổ thông.
- **Bám sát chương trình:** hỗ trợ trực tiếp các chủ đề *"Làm quen với học máy"*, *"Dữ liệu và AI"*, *"AI có trách nhiệm"*. Dùng được cho Tin học THPT (khối 10–12) và các chương trình giáo dục AI/STEM.
- **Liên môn:** Sinh học (phân loại lá cây, côn trùng), Môi trường (phân loại rác), Thể dục (nhận diện động tác), Âm nhạc (nhận diện nhạc cụ), Ngoại ngữ (nhận diện phát âm).
- **Dạy đạo đức AI một cách trực quan:** cho học sinh tự tạo ra một mô hình thiên lệch, rồi phân tích nguyên nhân.
- **Phân hóa được:**
  - Học sinh cơ bản chỉ cần huấn luyện và thử mô hình.
  - Học sinh khá chỉnh tham số, đọc ma trận nhầm lẫn.
  - Học sinh giỏi xuất mô hình sang Scratch, p5.js, Arduino để làm sản phẩm.

### 3.2. Khó khăn thường gặp

| Khó khăn | Mô tả | Gợi ý xử lý |
|---|---|---|
| Giao diện tiếng Anh | Học sinh tiểu học và THCS lúng túng với thuật ngữ | Chuẩn bị phiếu hướng dẫn song ngữ, bảng thuật ngữ |
| Thiếu webcam / micro | Nhiều phòng máy không có thiết bị ngoại vi | Chuẩn bị sẵn bộ ảnh mẫu để tải lên; cho học sinh làm theo nhóm |
| Mạng yếu | Cần tải trang và mô hình nền lần đầu | Mở sẵn trang trước giờ học; trang tự lưu đệm sau lần tải đầu |
| Máy cấu hình thấp | Huấn luyện chậm, trình duyệt treo | Giảm số mẫu (30–50 mẫu/lớp), đóng tab khác |
| Mất dữ liệu | Đóng tab là mất dự án nếu chưa lưu | Nhắc học sinh lưu tệp `.tm` về máy hoặc lưu Google Drive |
| Quyền riêng tư | Học sinh chụp mặt mình và bạn bè | Ưu tiên đối tượng là đồ vật/cử chỉ; không upload mô hình có khuôn mặt |
| Đánh giá kết quả | Khó chấm điểm vì "mô hình chạy được" chưa chắc là hiểu bài | Dùng rubric chấm cả quy trình: thiết kế dữ liệu, kiểm thử, giải thích lỗi |
| Hiểu nhầm về AI | Học sinh nghĩ AI "hiểu" giống người | Luôn kết thúc bằng hoạt động tìm trường hợp mô hình sai và giải thích vì sao |

### 3.3. Hoạt động dạy học được giáo viên đánh giá cao

1. **"Mèo hay chó?" – thiên lệch dữ liệu** (theo giáo trình MIT): một lớp có nhiều ảnh hơn hẳn lớp kia, hoặc toàn ảnh một giống. Học sinh quan sát mô hình đoán sai, rồi thảo luận về dữ liệu không cân bằng.
2. **"Đánh lừa mô hình":** huấn luyện với nền cố định, sau đó đổi nền để mô hình sai. Hoạt động này dạy khái niệm shortcut learning và khái quát hóa.
3. **Phân loại rác thông minh:** dự án nhóm gắn với giáo dục môi trường, có thể nối với Arduino để điều khiển nắp thùng rác.
4. **Trò chơi điều khiển bằng cử chỉ hoặc giọng nói:** xuất mô hình sang Scratch, tạo động lực mạnh cho học sinh.
5. **So sánh số mẫu:** huấn luyện với 10, 50, 200 mẫu, ghi lại độ chính xác, rồi vẽ đồ thị và rút ra kết luận.

### 3.4. Nhận định tổng quát

> Phần lớn giáo viên đánh giá TM là **công cụ "khởi động" lý tưởng** cho giáo dục AI: tạo được "khoảnh khắc wow" và giúp học sinh hiểu vai trò của dữ liệu. Giá trị sư phạm phụ thuộc lớn vào **thiết kế hoạt động** của giáo viên. Nếu chỉ dừng ở mức "bấm cho chạy", học sinh khó hiểu sâu.

---

## 4. Góc nhìn học sinh

### 4.1. Học sinh thích gì

- **"Mình tự dạy được máy tính!"** Học sinh cảm thấy mình làm chủ công nghệ, AI không còn là thứ xa vời.
- **Kết quả tức thì:** chỉ vài phút là có mô hình chạy trên webcam, có thể khoe với bạn bè.
- **Không cần biết lập trình,** nên học sinh chưa giỏi Tin học vẫn tham gia được.
- **Gắn với sở thích:** điều khiển game, nhận diện thú cưng, đồ chơi, tư thế nhảy.
- **Làm được sản phẩm thật** khi kết hợp Scratch, robot, Arduino, dùng cho dự án KHKT và cuộc thi STEM.

### 4.2. Học sinh gặp khó gì

- Thuật ngữ tiếng Anh như *epoch, batch size, learning rate, confusion matrix* khó hiểu nếu không được giải thích.
- **Không hiểu vì sao mô hình sai.** Ở nhà thì đúng, lên lớp lại sai do ánh sáng và nền khác. Học sinh dễ nản nếu không được hướng dẫn.
- **Dễ "ảo tưởng" độ chính xác:** thấy 100% trên tập huấn luyện thì nghĩ mô hình hoàn hảo.
- **Sau khi làm quen thì thấy nhàm,** vì chỉ có phân loại. Học sinh giỏi muốn tìm hiểu tiếp mà không biết đi đâu.
- Mất dự án vì quên lưu, hoặc không xuất được sang Scratch do chưa biết cách dùng extension.

### 4.3. Kết quả học tập điển hình

| Mức độ | Học sinh làm được |
|---|---|
| Nhận biết | Kể được 3 bước: thu thập dữ liệu, huấn luyện, dự đoán |
| Thông hiểu | Giải thích được vì sao số lượng và độ đa dạng của dữ liệu ảnh hưởng đến kết quả |
| Vận dụng | Tự thiết kế bộ dữ liệu cho một bài toán thực tế, kiểm thử với dữ liệu mới |
| Vận dụng cao | Phát hiện và giải thích thiên lệch; tích hợp mô hình vào sản phẩm (game, robot, web) |

---

## 5. Góc nhìn người sử dụng nói chung (maker, nhà phát triển, người làm sáng tạo)

### 5.1. Đánh giá tích cực

- **Tạo mẫu nhanh (rapid prototyping):** dùng để thử ý tưởng trước khi đầu tư bộ dữ liệu lớn.
- **Miễn phí, không giới hạn số dự án,** không cần đăng ký để huấn luyện.
- **Xuất mô hình linh hoạt,** có mã mẫu sẵn, nhúng vào web chỉ với vài dòng JavaScript.
- **Chạy được trên thiết bị biên:** TFLite và Edge TPU phù hợp cho Raspberry Pi, Coral, điện thoại.
- Được dùng trong **nghệ thuật tương tác, bảo tàng, hỗ trợ người khuyết tật** (ví dụ các dự án nhận diện âm thanh và cử chỉ cho người khó vận động hoặc khó nói, được Google giới thiệu).

### 5.2. Phàn nàn phổ biến

- **Độ chính xác không đủ cho sản phẩm thật.** Mô hình nhạy với điều kiện môi trường, nên không dùng được cho ứng dụng quan trọng như y tế hay an ninh.
- **Không huấn luyện tiếp được (fine-tune) sau khi xuất.** Muốn cải thiện thì phải quay lại TM hoặc tự viết mã.
- **Không có API hay CLI** để tự động hóa, không quản lý được phiên bản mô hình.
- **Mô hình âm thanh khó tích hợp** ngoài TensorFlow.js. Mô hình tư thế dùng PoseNet đã lỗi thời.
- **Tương thích phiên bản:** mã mẫu đôi khi lệch phiên bản TensorFlow.js hoặc ml5.js mới, gây lỗi khi chạy.
- **Trải nghiệm trên di động hạn chế,** nên dùng trên máy tính để bàn với Chrome.

---

## 6. Phân tích SWOT tổng hợp

| **Điểm mạnh (S)** | **Điểm yếu (W)** |
|---|---|
| Không cần lập trình, rất dễ dùng | Chỉ có bài toán phân loại |
| Miễn phí, chạy trên trình duyệt | Mô hình nền cũ, độ chính xác hạn chế |
| Dữ liệu xử lý cục bộ, bảo vệ quyền riêng tư | Thiếu công cụ giải thích, không kiểm soát được tập kiểm tra |
| Xuất mô hình chuẩn, tích hợp đa nền tảng | Giao diện chủ yếu tiếng Anh |
| Học liệu và cộng đồng phong phú | Không có lớp học, quản lý học sinh, chấm bài |

| **Cơ hội (O)** | **Thách thức (T)** |
|---|---|
| Giáo dục AI đang được đưa vào chương trình phổ thông ở nhiều nước, trong đó có Việt Nam | Các công cụ cạnh tranh như ML for Kids, PictoBlox, Edge Impulse, Roboflow, Lobe (đã ngừng) và công cụ AI tạo sinh |
| Kết hợp với STEM, robot, IoT, dự án KHKT | Google có thể ngừng hoặc ít cập nhật sản phẩm thử nghiệm |
| Dạy đạo đức AI và thiên lệch dữ liệu một cách trực quan | Học sinh quen AI tạo sinh nên thấy TM "đơn giản" |
| Xây dựng học liệu tiếng Việt quanh TM | Lo ngại quyền riêng tư khi dữ liệu khuôn mặt trẻ em bị upload |

---

## 7. So sánh nhanh với công cụ tương tự

| Tiêu chí | Teachable Machine | Machine Learning for Kids | PictoBlox (ML Environment) | Edge Impulse |
|---|---|---|---|---|
| Đối tượng | Mọi lứa tuổi, người mới | Tiểu học – THCS | Tiểu học – THPT, STEM | THPT, đại học, kỹ sư |
| Cần tài khoản | Không (trừ khi lưu Drive) | Có (giáo viên quản lý) | Có | Có |
| Loại dữ liệu | Ảnh, âm thanh, tư thế | Văn bản, ảnh, số, âm thanh | Ảnh, âm thanh, tư thế, văn bản, số | Cảm biến, âm thanh, ảnh |
| Lập trình kèm | Xuất mô hình; Scratch qua extension | Scratch, Python tích hợp sẵn | Khối lệnh và Python tích hợp sẵn | C++/SDK nhúng |
| Quản lý lớp học | Không | Có | Có (bản trả phí) | Có (nhóm/dự án) |
| Chạy offline | Một phần (sau khi tải trang) | Không | Có (bản desktop) | Không |
| Chi phí | Miễn phí | Miễn phí | Freemium | Freemium |

---

## 8. Khuyến nghị

### 8.1. Cho giáo viên và nhà trường

1. Dùng TM như **hoạt động mở đầu** (1–3 tiết) cho chủ đề học máy, rồi nâng dần lên Scratch + TM, sau đó Python/Colab.
2. Thiết kế bài học theo chu trình **Dự đoán → Huấn luyện → Kiểm thử → Phát hiện lỗi → Cải thiện**, không dừng ở "chạy được".
3. Luôn có **một hoạt động về thiên lệch và giới hạn của AI** trong mỗi chủ đề.
4. Ban hành **quy định về dữ liệu cá nhân:** hạn chế ảnh khuôn mặt, không upload mô hình có dữ liệu nhạy cảm, xóa dự án sau buổi học.
5. Biên soạn **phiếu học tập và bảng thuật ngữ tiếng Việt;** chuẩn bị sẵn bộ dữ liệu mẫu cho phòng máy không có webcam.
6. Đánh giá theo **rubric quy trình:** chất lượng thiết kế dữ liệu, cách kiểm thử, khả năng giải thích lỗi, ý thức đạo đức.

### 8.2. Cho học sinh

- Thu thập dữ liệu **đa dạng** về góc chụp, ánh sáng, nền và người thực hiện.
- Luôn **thử với dữ liệu mới** mà mô hình chưa từng thấy trước khi kết luận.
- Đọc mục *Under the hood*, đặc biệt là ma trận nhầm lẫn, để biết mô hình hay nhầm ở đâu.
- Lưu dự án thường xuyên (tệp `.tm` hoặc Google Drive).
- Khi đã thành thạo, thử xuất mô hình sang Scratch hoặc p5.js, rồi tìm hiểu Python/Keras.

### 8.3. Cho người phát triển / maker

- Dùng TM để **tạo mẫu nhanh và kiểm chứng ý tưởng.** Khi lên sản phẩm, chuyển sang huấn luyện lại bằng Keras/TFLite Model Maker hoặc Edge Impulse với dữ liệu lớn hơn.
- Ghim phiên bản thư viện TensorFlow.js / ml5.js trùng với mã mẫu để tránh lỗi tương thích.
- Không upload mô hình chứa dữ liệu riêng tư lên link chia sẻ công khai.

---

## 9. Kết luận

| Góc nhìn | Đánh giá chung | Điểm tham khảo* |
|---|---|---|
| Chuyên gia | Công cụ nhập môn xuất sắc, minh họa đúng bản chất ML; hạn chế về chiều sâu và độ hiện đại | 8/10 |
| Giáo viên | Dễ triển khai, hiệu quả tạo hứng thú; cần thiết kế hoạt động tốt và hỗ trợ ngôn ngữ | 8,5/10 |
| Học sinh | Thú vị, dễ dùng, có thành quả ngay; dễ nhàm nếu không có hướng phát triển tiếp | 9/10 |
| Người dùng chung | Tạo mẫu nhanh rất tốt; chưa đủ cho sản phẩm thực tế | 7/10 |

\* *Điểm tham khảo do người lập tài liệu tổng hợp định tính từ các nguồn bên dưới, không phải kết quả khảo sát định lượng.*

**Tóm lại:** Teachable Machine là **cánh cửa tốt nhất để bắt đầu** giáo dục AI ở phổ thông nhờ chi phí bằng 0, không cần lập trình, bảo vệ dữ liệu và minh họa trực quan vai trò của dữ liệu. Để phát huy giá trị, cần coi nó là **bước đầu của một lộ trình**, đặt trong các hoạt động có chủ đích về kiểm thử, thiên lệch và đạo đức AI.

---

## 10. Tài liệu tham khảo

1. Carney, M., Webster, B., Alvarado, I., et al. (2020). *Teachable Machine: Approachable Web-Based Tool for Exploring Machine Learning Classification.* CHI EA '20, ACM.
2. Google (11/2019). *Teachable Machine 2.0 makes AI easier for everyone.* Google Blog (The Keyword).
3. Payne, B. H. (2019). *An Ethics of Artificial Intelligence Curriculum for Middle School Students.* MIT Media Lab.
4. Touretzky, D., Gardner-McCune, C., Martin, F., Seehorn, D. (2019). *Envisioning AI for K-12: What Should Every Child Know about AI?* AAAI. (Khung AI4K12 – "5 Big Ideas")
5. Trang chính thức và FAQ: <https://teachablemachine.withgoogle.com/faq>
6. The Coding Train – chuỗi bài *Teachable Machine* với ml5.js (YouTube, Daniel Shiffman).
7. Các đánh giá và nhận xét của giáo viên trên Common Sense Education và các cộng đồng giáo dục STEM.

> **Lưu ý:** Một số thông số kỹ thuật (tham số mặc định, định dạng xuất, giới hạn dữ liệu) có thể thay đổi theo thời gian. Nên kiểm tra lại trên trang chính thức trước khi đưa vào giáo án.
