import type { Lesson } from './types';

export const lessonTraining: Lesson = {
  id: 'day-may-phan-biet-hinh',
  minutes: 90,
  title: 'Dạy máy phân biệt hình',
  summary: 'Đi qua cả quy trình học máy: dữ liệu, biểu diễn, huấn luyện và đánh giá trên ba lớp hình.',
  dataset: 'shapes-3',
  goals: [
    'Nêu được các bước của quy trình học máy: dữ liệu → biểu diễn → huấn luyện → đánh giá.',
    'Giải thích vì sao cần tách riêng tập Huấn luyện và tập Kiểm tra.',
    'Mô tả huấn luyện là quá trình đoán, so với đáp án và sửa lỗi lặp lại qua nhiều epoch.',
    'Đọc được ma trận nhầm lẫn để biết mô hình hay nhầm lớp nào với lớp nào.',
  ],
  steps: [
    {
      title: 'Bước 1 và 2: Dữ liệu, Kiểm tra dữ liệu',
      body: [
        'Bấm "Tạo dự án mẫu cho bài này". Dự án có 3 lớp: Hình tròn, Hình vuông, Tam giác; mỗi lớp 18 ảnh Huấn luyện và 6 ảnh Kiểm tra.',
        'Xem bảng "Kiểm tra dữ liệu": số ảnh các lớp có cân bằng không?',
      ],
      predict: {
        question: 'Vì sao phải giấu riêng 6 ảnh mỗi lớp ở ngăn Kiểm tra, không cho máy học?',
        answer:
          'Để chấm điểm công bằng. Nếu kiểm tra bằng chính ảnh đã học, máy có thể chỉ "học thuộc" mà vẫn được điểm cao. Ảnh Kiểm tra giống như đề thi mới.',
      },
    },
    {
      title: 'Bước 3: Biểu diễn',
      body: [
        'Bấm "Biến ảnh thành vector". Mỗi ảnh được MobileNetV2 tóm lại thành 1.280 con số đặc trưng.',
        'Quan sát Bản đồ dữ liệu 2D. Bấm vào vài chấm để xem ảnh và 3 ảnh Huấn luyện giống nhất.',
      ],
      predict: {
        question: 'Trên bản đồ, các chấm cùng một lớp sẽ nằm gần nhau hay rải rác khắp nơi?',
        answer:
          'Thường các chấm cùng lớp sẽ gom lại thành cụm, vì ảnh giống nhau có vector giống nhau. Nhưng bản đồ chỉ giữ một phần thông tin (xem dòng "giữ được …%"), nên có thể vẫn thấy vài chỗ chồng lên nhau.',
      },
      record: [{ kind: 'fields', title: 'Em ghi lại', fields: ['Bản đồ giữ được bao nhiêu % biến thiên:'], answers: ['60,4%'] }],
    },
    {
      title: 'Bước 4: Huấn luyện từng bước',
      body: [
        'Chọn tốc độ "Từng bước", bấm "Bắt đầu huấn luyện", rồi bấm "Epoch tiếp theo" khoảng 5 lần. Quan sát biểu đồ độ chính xác.',
        'Sau đó bấm "Chạy hết".',
      ],
      predict: {
        question: 'Ở epoch 0 (trước khi học), với 3 lớp, độ chính xác sẽ khoảng bao nhiêu?',
        answer:
          'Khoảng 33% nếu đoán bừa 1 trong 3. Nhưng trọng số ban đầu là ngẫu nhiên và tập Kiểm tra chỉ có 18 ảnh, nên con số thật có thể lệch khá xa, ví dụ 22% hay 44%. Điều quan trọng là nó thấp, rồi tăng nhanh sau vài epoch.',
      },
      record: [
        {
          kind: 'table',
          title: 'Kéo thanh "Phát lại" tới từng epoch và ghi điểm',
          columns: ['Epoch', 'Điểm Huấn luyện (%)', 'Điểm Kiểm tra (%)'],
          rows: ['0', '5', '50'],
          answers: [
            ['44,4', '22,2'],
            ['98,1', '77,8'],
            ['100', '100'],
          ],
        },
      ],
    },
    {
      title: 'Bước 5: Đánh giá',
      body: [
        'So sánh "Điểm trên bài đã học" và "Điểm trên bài chưa học".',
        'Ở epoch cuối, mô hình có thể đã đúng hết: mọi ô ngoài đường chéo của Ma trận nhầm lẫn đều bằng 0. Kéo thanh Phát lại về epoch 5, lúc mô hình còn nhầm: tìm ô ngoài đường chéo có số lớn nhất và bấm vào để xem các ảnh bị nhầm.',
        'Kéo dần thanh Phát lại lên epoch 50 để thấy các ô ngoài đường chéo giảm dần về 0.',
      ],
      predict: {
        question: 'Điểm trên tập Kiểm tra thường cao hơn hay thấp hơn tập Huấn luyện?',
        answer: 'Thường thấp hơn hoặc bằng, vì đó là những ảnh mô hình chưa từng thấy. Chênh lệch quá lớn là dấu hiệu "quá khớp".',
      },
      record: [
        {
          kind: 'confusion',
          title: 'Chép ma trận nhầm lẫn trên tập Kiểm tra ở epoch 5 (số ảnh)',
          // hàng = lớp thật (tròn, vuông, tam giác), cột = lớp mô hình đoán
          answers: [
            [6, 0, 0],
            [0, 3, 3],
            [0, 1, 5],
          ],
        },
        {
          kind: 'fields',
          title: 'Em rút ra',
          fields: ['Ô ngoài đường chéo lớn nhất (ở epoch 5):'],
          answers: ['Hình vuông bị đoán là Tam giác (3 ảnh)'],
        },
      ],
    },
    {
      title: 'Thí nghiệm nhỏ',
      body: [
        'Chuyển sang chế độ Chuyên sâu, đặt Số epoch = 3 rồi huấn luyện lại. Trong Nhật ký thí nghiệm, đánh dấu "So sánh" cho cả hai lần chạy.',
        'Ghi lại: số epoch ảnh hưởng thế nào đến điểm Kiểm tra?',
      ],
      record: [
        {
          kind: 'table',
          title: 'So sánh hai lần chạy trong Nhật ký thí nghiệm',
          columns: ['Số epoch', 'Điểm Huấn luyện (%)', 'Điểm Kiểm tra (%)'],
          rows: ['50', '3'],
          answers: [
            ['100', '100'],
            ['94,4', '72,2'],
          ],
        },
      ],
    },
  ],
  quiz: [
    {
      question: 'Một "epoch" là gì?',
      options: [
        'Một lượt mô hình học qua toàn bộ ảnh Huấn luyện',
        'Một bức ảnh trong tập Kiểm tra',
        'Số lớp của dự án',
      ],
      correct: 0,
      explanation: 'Mỗi epoch, mô hình đi qua hết các ảnh Huấn luyện một lần và điều chỉnh trọng số.',
    },
    {
      question: 'Trong ma trận nhầm lẫn, ô ở hàng "Hình vuông", cột "Tam giác" có số 2 nghĩa là gì?',
      options: [
        '2 ảnh tam giác bị đoán là hình vuông',
        '2 ảnh hình vuông bị đoán là tam giác',
        'Có 2 lớp bị nhầm',
      ],
      correct: 1,
      explanation: 'Hàng là lớp thật, cột là lớp máy đoán.',
    },
    {
      question: 'Vì sao điểm trên tập Kiểm tra đáng tin hơn điểm trên tập Huấn luyện?',
      options: [
        'Vì tập Kiểm tra có nhiều ảnh hơn',
        'Vì đó là ảnh mô hình chưa từng học, giống như đề thi mới',
        'Vì tập Kiểm tra dễ hơn',
      ],
      correct: 1,
      explanation: 'Điểm trên dữ liệu chưa thấy cho biết mô hình có khái quát được hay chỉ học thuộc.',
    },
  ],
  wrapUp:
    'Học máy gồm các bước: thu thập dữ liệu, biến dữ liệu thành con số đặc trưng, huấn luyện bằng cách đoán – so đáp án – sửa lỗi qua nhiều epoch, rồi đánh giá trên dữ liệu chưa thấy. Ma trận nhầm lẫn cho biết mô hình sai ở đâu.',
  teacherNotes: [
    'Bài dài 2 tiết: tiết 1 đến hết bước 3, tiết 2 từ bước 4.',
    'Kết quả huấn luyện tái lập được (seed cố định): cả lớp làm cùng bộ dữ liệu sẽ ra cùng con số hoặc chỉ lệch rất nhỏ giữa các máy, tiện cho việc so sánh.',
    'Học sinh có thể dùng chế độ Chuyên sâu để xem công thức W·x + b và bảng precision / recall.',
    'Đã kiểm chứng với MobileNetV2: epoch 0 Huấn luyện 44,4% / Kiểm tra 22,2%; epoch 5 98,1% / 77,8% (nhầm 3 vuông → tam giác, 1 tam giác → vuông); epoch 50 đạt 100% / 100%. Chạy 3 epoch: 94,4% / 72,2%.',
  ],
};
