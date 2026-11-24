# Mô hình nền (tự lưu trữ)

Các mô hình được lưu ngay trong repo để trang chạy được ngoại tuyến và không tải gì từ máy chủ bên ngoài.
Tải lại bằng: `node scripts/fetch-models.mjs`

## mobilenet-v2-035

| | |
|---|---|
| Kiến trúc | MobileNetV2, hệ số độ rộng α = 0,35, đầu vào 224×224×3, không có tầng phân loại (*no top*) |
| Đầu ra dùng làm đặc trưng | Tầng `out_relu` (7×7×1280) → trung bình theo không gian → vector 1280 chiều |
| Tiền xử lý | Giá trị điểm ảnh `v ∈ [0, 255]` → `v / 127,5 − 1 ∈ [−1, 1]` |
| Định dạng | TensorFlow.js LayersModel (155 tầng) |
| Trọng số gốc | Keras Applications, huấn luyện trên ImageNet. Giấy phép **Apache-2.0** |
| Bản chuyển đổi | Google Teachable Machine (`storage.googleapis.com/teachable-machine-models/…0.35_224_no_top`) |
| Kích thước | ~1,6 MB trọng số + 0,1 MB cấu trúc |

**SHA-256**

```
model.json             743ac7298e845e2c2ef2c361cb2dad84b8bfc67ccbef1fefc20146d529b17030
group1-shard1of1.bin   d366835afb87a9a6915084f00635339c2c8e137760cd891ab234340194ca1913
```

Tài liệu gốc: Sandler, M. et al. (2018). *MobileNetV2: Inverted Residuals and Linear Bottlenecks.* CVPR.

## movenet-lightning-4

| | |
|---|---|
| Kiến trúc | MoveNet SinglePose Lightning v4 (Google), nhận dạng 17 khớp của MỘT người |
| Đầu vào | Ảnh 192×192×3, số nguyên 0–255; ảnh gốc được đệm viền đen thành hình vuông rồi thu nhỏ |
| Đầu ra | `[1, 1, 17, 3]` = (y, x, độ tin cậy) của 17 khớp, tọa độ 0–1 trong ô vuông đã đệm |
| Định dạng | TensorFlow.js GraphModel |
| Nguồn | <https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4> — giấy phép **Apache-2.0** |
| Kích thước | ~4,4 MB trọng số |

**SHA-256**

```
c65a3447162efa0c42af29498a4b151f4415b36ff3ae6fae2b28a32e840dcbfb  model.json
b42c3232bf13b0efc691d3f0693dd3fc74404f709b1deee0a271828af6dbbea2  group1-shard1of2.bin
8253ab965aa3122c08f331777ca395ce9ca19bb9e7cb278b99de1c46dbdeb6dc  group1-shard2of2.bin
```

## hand-landmark-lite-1

| | |
|---|---|
| Kiến trúc | MediaPipe Hand Landmark (lite), 21 điểm mốc bàn tay |
| Đầu vào | Ô vuông 224×224×3 chứa bàn tay, giá trị 0–1 (LUP Machine không dùng bộ dò lòng bàn tay: học sinh đặt tay vào khung hướng dẫn, hoặc ảnh tải lên được dùng nguyên) |
| Đầu ra dùng | `Identity_2` = 21 × (x, y, z) theo pixel của ô 224; `Identity_1` = xác suất có bàn tay (kiểm chứng: 0,003 với ô trống, 0,87 với ảnh bàn tay) |
| Định dạng | TensorFlow.js GraphModel |
| Nguồn | <https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/landmark/lite/1> — giấy phép **Apache-2.0** |
| Kích thước | ~1,9 MB trọng số |

**SHA-256**

```
2d6bd4d3b34a684e96293ff71e31f9fbc1b4922e0a88d82184cb584055ff3783  model.json
444bee1c7d6d330991bd3ce840a95d0c0afcc3a3fcec47c0c3b7f66a3f3533b0  group1-shard1of1.bin
```

## face-detection-short-1

| | |
|---|---|
| Kiến trúc | MediaPipe BlazeFace short-range: phát hiện khuôn mặt ở gần (ảnh chân dung, webcam) |
| Đầu vào | 128×128×3, giá trị `v / 127,5 − 1 ∈ [−1, 1]` (LUP Machine đệm ảnh thành ô vuông, viền đen) |
| Đầu ra | `Identity` = [896, 17] cho mỗi anchor: **[logit độ tin cậy, cx, cy, w, h, 6 điểm mốc × (x, y)]** theo pixel của ô 128 so với tâm anchor. Bản TF.js này đặt độ tin cậy ở ĐẦU (đo trên ảnh thật: ô trắng có kênh 0 ≤ −3, ảnh có mặt > 0), khác thứ tự của bản MediaPipe gốc |
| Anchor | 4 tầng, bước 8 / 16 / 16 / 16, 2 anchor mỗi tầng mỗi ô → lưới 16×16×2 + 8×8×6 = 896 |
| Dùng để | Chỉ để LÀM MỜ khuôn mặt trước khi lưu ảnh (không nhận dạng ai, không lưu đặc điểm khuôn mặt) |
| Giới hạn đã biết | Khuôn mặt quá nhỏ trong ảnh (người đứng xa) có thể không được phát hiện |
| Định dạng | TensorFlow.js GraphModel |
| Nguồn | <https://tfhub.dev/mediapipe/tfjs-model/face_detection/short/1> — giấy phép **Apache-2.0** |
| Kích thước | ~0,2 MB trọng số |

**SHA-256**

```
c131145fade749f714d39811f282e973760a69cb9e1a9c22f91e132bd8dcd396  model.json
e9b69ee1c1f8cd33c58120bcd75bf8c56bfba20c880f447e9d293ec102059d4b  group1-shard1of1.bin
```
