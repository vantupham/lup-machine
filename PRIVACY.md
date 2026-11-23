# Quyền riêng tư

*Viết cho học sinh, phụ huynh và giáo viên.*

## Tóm tắt một dòng

**LUP Machine không thu thập bất kỳ dữ liệu nào của bạn.** Mọi thứ chạy và được lưu ngay trên trình duyệt của máy bạn đang dùng.

## Chi tiết

| Câu hỏi | Trả lời |
|---|---|
| Ảnh, âm thanh, văn bản tôi đưa vào được lưu ở đâu? | Trong bộ nhớ trình duyệt (IndexedDB) của chính máy đó. Không gửi lên mạng. |
| Có máy chủ nhận dữ liệu không? | **Không.** Trang được phục vụ dạng tĩnh từ GitHub Pages; không có máy chủ nào của dự án nhận dữ liệu. |
| Có cần tài khoản, email không? | Không. |
| Có cookie theo dõi, quảng cáo, công cụ phân tích không? | Không. |
| Camera và micro dùng thế nào? | Chỉ bật khi bạn bấm và trình duyệt hỏi ý kiến. Hình ảnh và âm thanh được xử lý tại chỗ và tắt khi rời trang. |
| Studio âm thanh lưu gì? | Chỉ đoạn âm thanh 1 giây đã đưa về 16 kHz. Tệp gốc bạn tải lên không được giữ lại. |
| Studio tư thế & bàn tay lưu gì? | **Chỉ tọa độ các khớp** (ví dụ vai ở điểm ảnh 210, 150). Ảnh và khung hình camera không được lưu. |
| Notebook Colab chứa gì? | Đặc trưng (con số) và nhãn của dự án, **không** chứa ảnh hay âm thanh gốc (riêng dự án bảng và văn bản chứa đúng các dòng / câu đã dùng). Notebook được tạo trên máy bạn; chỉ khi bạn tự tải lên Colab thì nó mới nằm trên Google Drive của bạn. |
| Khi nào dữ liệu rời khỏi máy? | Chỉ khi **bạn** bấm "Xuất" để tạo tệp, rồi **bạn** tự gửi tệp đó cho người khác. |
| Trình duyệt có ghi nhớ gì khác không? | Chỉ ngôn ngữ và chế độ học bạn chọn (localStorage). |
| "Dùng được khi mất mạng" nghĩa là lưu gì? | Trình duyệt lưu sẵn **tệp của ứng dụng** (mã, giao diện, các mô hình nền: MobileNet ~1,7 MB, MoveNet ~4,6 MB, bàn tay ~2 MB) để chạy khi không có mạng. Không lưu và không gửi dữ liệu học tập của bạn. Xóa bằng cách xóa dữ liệu trang web trong cài đặt trình duyệt. |
| Làm sao xóa hết dữ liệu? | Vào **Giới thiệu & Quyền riêng tư → Xóa toàn bộ dữ liệu trên máy này**, hoặc xóa dữ liệu trang web trong cài đặt trình duyệt. |

## Lưu ý về GitHub Pages

Như mọi trang web, máy chủ của GitHub (đơn vị lưu trữ trang) có thể ghi nhật ký kỹ thuật khi trình duyệt tải trang, ví dụ địa chỉ IP. Xem chính sách của GitHub: <https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement>. Dữ liệu học tập của bạn không đi kèm các yêu cầu này.

## Lời khuyên cho giáo viên

- Ưu tiên cho học sinh làm dự án với **đồ vật, cử chỉ, âm thanh** thay vì khuôn mặt.
- Trên máy dùng chung ở phòng tin, nhắc học sinh **xóa dữ liệu** cuối buổi.
- Khi thu bài nộp, chỉ lưu tệp trong phạm vi lớp học và xóa khi không còn cần.

## Liên hệ

Câu hỏi về quyền riêng tư: mở issue tại <https://github.com/vantupham/lup-machine/issues>.
