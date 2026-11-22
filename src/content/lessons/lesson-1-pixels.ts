import type { Lesson } from './types';

export const lessonPixels: Lesson = {
  id: 'may-tinh-nhin-anh',
  grade: '6–9',
  minutes: 45,
  title: 'Máy tính nhìn ảnh như thế nào?',
  summary: 'Khám phá vì sao với máy tính, một bức ảnh chỉ là một bảng rất nhiều con số.',
  dataset: 'shapes-2',
  goals: [
    'Biết ảnh số được tạo từ các điểm ảnh (pixel) xếp thành lưới.',
    'Biết mỗi điểm ảnh được ghi bằng 3 con số Đỏ, Xanh lá, Xanh dương, mỗi số từ 0 đến 255.',
    'Tính được số lượng con số trong một ảnh 224 × 224.',
    'Hiểu rằng máy tính chỉ "thấy" các con số, chưa hiểu ý nghĩa của ảnh.',
  ],
  steps: [
    {
      title: 'Khởi động',
      body: [
        'Hãy tưởng tượng em phải gọi điện thoại để mô tả một bức tranh cho bạn vẽ lại, nhưng chỉ được đọc các con số.',
      ],
      predict: {
        question: 'Em sẽ dùng các con số để mô tả bức tranh như thế nào?',
        answer:
          'Một cách là chia bức tranh thành lưới ô vuông nhỏ, rồi đọc màu của từng ô bằng con số. Máy tính lưu ảnh đúng theo cách này: mỗi ô là một điểm ảnh.',
      },
    },
    {
      title: 'Mở Kính hiển vi',
      body: [
        'Bấm "Tạo dự án mẫu cho bài này", rồi bấm vào một ảnh bất kỳ trong lớp "Hình tròn" để mở Kính hiển vi.',
        'Dùng phím mũi tên (giữ Shift để đi nhanh) di chuyển ô chọn lên vùng nền, rồi lên vùng hình tròn. Ghi lại 3 con số Đỏ, Xanh lá, Xanh dương ở mỗi vùng.',
      ],
      predict: {
        question: 'Một điểm ảnh màu trắng sẽ có 3 con số khoảng bao nhiêu? Còn màu đen?',
        answer: 'Trắng ≈ (255, 255, 255): cả ba màu đều sáng nhất. Đen ≈ (0, 0, 0): không có ánh sáng. Đỏ tươi ≈ (255, 0, 0).',
      },
    },
    {
      title: 'Đếm các con số',
      body: [
        'Ảnh trong LUP Machine có 224 hàng và 224 cột điểm ảnh. Mỗi điểm ảnh có 3 con số.',
      ],
      predict: {
        question: 'Một ảnh có tất cả bao nhiêu con số?',
        answer: '224 × 224 × 3 = 150.528 con số. Đây chính là thứ duy nhất máy tính nhận được từ bức ảnh.',
      },
    },
    {
      title: 'Thảo luận',
      body: [
        'Nhìn lưới 7 × 7 trong Kính hiển vi: các ô ở mép hình tròn có màu pha trộn giữa nền và hình.',
        'Câu hỏi thảo luận: chỉ với 150.528 con số, máy tính đã "biết" đây là hình tròn chưa?',
      ],
      predict: {
        question: 'Máy tính đã biết đây là hình tròn chưa?',
        answer:
          'Chưa. Lúc này máy tính chỉ có các con số. Để nhận ra "hình tròn", máy cần một bước học từ nhiều ví dụ — đó là nội dung của bài tiếp theo.',
      },
    },
  ],
  quiz: [
    {
      question: 'Điểm ảnh (pixel) là gì?',
      options: ['Một ô màu nhỏ nhất trong lưới tạo nên bức ảnh', 'Một đường thẳng trong ảnh', 'Tên của tệp ảnh'],
      correct: 0,
      explanation: 'Ảnh số là một lưới các ô màu nhỏ; mỗi ô là một điểm ảnh.',
    },
    {
      question: 'Điểm ảnh có giá trị (Đỏ, Xanh lá, Xanh dương) = (0, 0, 255) có màu gì?',
      options: ['Đỏ', 'Xanh dương', 'Trắng'],
      correct: 1,
      explanation: 'Chỉ có kênh Xanh dương sáng nhất (255), hai kênh còn lại bằng 0.',
    },
    {
      question: 'Vì sao nói máy tính "chưa hiểu" bức ảnh khi chỉ có các con số?',
      options: [
        'Vì các con số bị sai',
        'Vì con số chỉ mô tả màu từng điểm, không nói lên đó là vật gì',
        'Vì máy tính không đọc được con số',
      ],
      correct: 1,
      explanation: 'Các con số chỉ là màu của từng điểm. Ý nghĩa ("đây là hình tròn") phải được học từ nhiều ví dụ.',
    },
  ],
  wrapUp:
    'Với máy tính, ảnh là một bảng rất nhiều con số: mỗi điểm ảnh có 3 số Đỏ, Xanh lá, Xanh dương từ 0 đến 255. Ảnh 224 × 224 có 150.528 con số. Muốn máy nhận ra vật trong ảnh, máy phải học từ dữ liệu.',
  teacherNotes: [
    'Không cần webcam: dự án mẫu dùng ảnh hình học do máy vẽ, không có ảnh học sinh.',
    'Có thể cho học sinh làm theo cặp: một em đọc số, một em đoán màu.',
    'Chế độ Chuyên sâu (THPT) hiển thị thêm giá trị sau chuẩn hóa về [−1, 1] để mở rộng.',
  ],
};
