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
