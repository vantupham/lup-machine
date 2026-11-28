# Video bài giảng: kết quả đo trước khi làm (PR0)

Ngày đo: 2026-11-27. Máy đo: Snapdragon X 10 nhân, 16 GB RAM, Windows 11.

## 1. Giọng máy tiếng Việt (Piper, chạy offline)

| Giọng | Dung lượng | Giấy phép dữ liệu | Dùng được? |
|---|---|---|---|
| `vi_VN-vais1000-medium` (1 giọng, 22 050 Hz) | 63,2 MB (int8: 18,7 MB) | CC BY 4.0 (VAIS-1000) | Có, phải ghi nguồn |
| `vi_VN-25hours_single-low` | 63,1 MB | Không rõ | Không |
| `vi_VN-vivos-x_low` (65 giọng) | 27,8 MB | CC BY-NC-SA 4.0 | Không (NC, SA không hợp với MIT) |

Đo bằng `piper-tts` 1.8.0 (bản native, chưa phải WASM), 5 câu mẫu lấy từ dự án lá đậu:

- Tốc độ đọc trung bình **4,6 âm tiết/giây**. Hằng số này dùng để ước lượng thời lượng cảnh và chia phụ đề khi chưa có âm thanh.
- Tạo 1 giây âm thanh tốn 0,07–0,43 giây CPU, tùy tải máy. Câu đầu chậm hơn vì khởi động mô hình (2,8 giây).
- Bản int8 nhỏ hơn 3,4 lần nhưng không nhanh hơn (0,63 so với 0,43 trong cùng lần đo). Chất lượng phải nghe để so.

Những việc còn phải làm ở PR5 (giọng máy):

- Chạy thử trong trình duyệt, qua sherpa-onnx WASM hoặc onnxruntime-web kèm piper-phonemize. Đã có báo cáo giọng Piper không phải tiếng Anh cho âm sai trên WASM (sherpa-onnx issue #846), nên phải nghe kiểm tra.
- Thêm `'wasm-unsafe-eval'` vào CSP.
- Chỉ tải mô hình khi người dùng chọn giọng máy, rồi lưu vào cache riêng, không precache.
- Đọc số: lời giảng cần hai dạng, chữ hiển thị ("72,2%") và chữ để đọc ("bảy mươi hai phẩy hai phần trăm"). Tự viết bộ đổi số sang chữ tiếng Việt, có unit test, thay vì phụ thuộc espeak.

## 2. Mã hóa video trong trình duyệt (WebCodecs)

Đo bằng Playwright, khung 2D có chữ và hình chuyển động, 300 khung hình, 30 fps, bitrate 3 Mb/s:

| Trình duyệt | H.264 720p / 9:16 / 1080p | AAC / Opus | Tốc độ 720p | Tốc độ 9:16 (720×1280) | Tốc độ 1080p |
|---|---|---|---|---|---|
| Chrome 158 | có / có / có | có / có | 14× thời gian thực | 16,6× | 10× |
| Edge 158 | có / có / có | có / có | 13,7× | 16,4× | 7,5× |
| Chromium 159 (Playwright) | có / có / có | có / có | 7,1× | 7,4× | 4,1× |

Kết luận:

- Video 5 phút ở 720p mã hóa trong khoảng 20–40 giây trên máy này. Máy trường yếu hơn khoảng 3–5 lần thì mất 2–3 phút, vẫn chấp nhận được. Giữ 720p làm mặc định.
- `MediaRecorder` hỗ trợ cả `video/mp4;codecs=avc1` lẫn WebM, đủ làm đường dự phòng (ghi theo thời gian thực).
- Chưa đo Firefox và Safari vì máy chưa cài các trình duyệt này trong Playwright. Kiểm tra `VideoEncoder.isConfigSupported` lúc chạy, không được thì chuyển sang dự phòng.
- Đóng gói MP4 bằng `mediabunny`, không có dependency phụ. Nếu trình duyệt không mã hóa được AAC thì dùng Opus trong MP4, hoặc gói `@mediabunny/aac-encoder`.
