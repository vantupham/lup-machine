# Bộ dữ liệu bảng mẫu

Dựng bằng `python scripts/build-tabular-datasets.py`. Tiêu đề cột được dịch sang tiếng Việt, giá trị giữ nguyên; ô thiếu trong dữ liệu gốc (`NA`) được giữ là ô trống để học sinh tập xử lý dữ liệu thật.

| Tệp | Nguồn | Giấy phép |
|---|---|---|
| `iris.csv` (150 dòng) | R. A. Fisher (1936), *Iris*, UCI Machine Learning Repository, <https://doi.org/10.24432/C56C76> | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `penguins.csv` (344 dòng) | K. B. Gorman, T. D. Williams, W. R. Fraser (2014), Palmer Station LTER; gói `palmerpenguins` của A. M. Horst, A. P. Hill, K. B. Gorman (2020), <https://github.com/allisonhorst/palmerpenguins> | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Thay đổi so với bản gốc: dịch tiêu đề cột; với Penguins, bỏ cột `year` và dịch giới tính (`male` → `đực`, `female` → `cái`).
