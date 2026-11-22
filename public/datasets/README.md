# Bộ ảnh thật có giấy phép mở

Các bộ ảnh trong thư mục này dùng cho nút "Tạo dự án mẫu" ở Xưởng mô hình. Mỗi bộ có `manifest.json` ghi **tác giả, nguồn và giấy phép của từng ảnh**. Ứng dụng hiển thị thông tin này trong Kính hiển vi và khi bấm vào ảnh trên bản đồ dữ liệu.

| Bộ | Lớp | Số ảnh | Nguồn gốc | Giấy phép |
|---|---|---|---|---|
| `flowers-3` | hoa cúc, hướng dương, hoa hồng | 90 (24 Dạy + 6 Kiểm tra mỗi lớp) | Ảnh Flickr của nhiều tác giả, tuyển từ bộ [tf_flowers](https://www.tensorflow.org/datasets/catalog/tf_flowers) của TensorFlow ([flower_photos.tgz](https://storage.googleapis.com/download.tensorflow.org/example_images/flower_photos.tgz), tác giả từng ảnh ghi trong `LICENSE.txt` của gói) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), ghi công từng ảnh |
| `beans-3` | lá khỏe, bệnh đốm góc, bệnh gỉ sắt | 90 (24 Dạy + 6 Kiểm tra mỗi lớp) | Bộ [ibean](https://github.com/AI-Lab-Makerere/ibean) của AIR Lab, Đại học Makerere (Uganda), cùng Viện NaCRRI; bản tải từ [Hugging Face AI-Lab-Makerere/beans](https://huggingface.co/datasets/AI-Lab-Makerere/beans) | [MIT](https://github.com/AI-Lab-Makerere/ibean/blob/master/LICENSE), © 2020 AIR Lab Makerere University (xem `beans-3/LICENSE.txt`) |

## Đã thay đổi gì so với ảnh gốc

Ảnh được cắt vuông ở giữa, thu nhỏ về 224×224 điểm ảnh, nén JPEG (chất lượng 85) và bỏ siêu dữ liệu EXIF.

## Tuyển chọn

- Ảnh được chọn tất định (sắp xếp tên tệp, xáo bằng seed cố định), nên chạy lại script luôn cho cùng bộ ảnh.
- Mọi ứng viên đều được **duyệt bằng mắt**. Ảnh bị loại vì có người, có chữ hoặc logo, là tranh hoặc ảnh đã chỉnh sửa, hoặc không đúng lớp. Danh sách ảnh bị loại nằm trong [`scripts/photo-datasets.json`](../../scripts/photo-datasets.json).
- Bộ lá đậu có nhiều ảnh bàn tay cầm lá. Đây là đặc điểm của bộ dữ liệu gốc chụp ngoài đồng; bàn tay không nhận diện được ai nên được giữ lại.

## Dựng lại

```bash
python scripts/build-photo-datasets.py --help
```
