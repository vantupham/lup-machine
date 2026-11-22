import type { Lesson } from './types';

export const lessonShortcut: Lesson = {
  id: 'ai-hoc-nham',
  grade: '9–12',
  minutes: 45,
  title: 'AI học nhầm điều gì?',
  summary: 'Một bộ dữ liệu có cài bẫy: mô hình đạt điểm cao lúc học nhưng thất bại khi kiểm tra. Hãy tìm ra vì sao.',
  dataset: 'background-trap',
  goals: [
    'Nhận ra hiện tượng "học lối tắt": mô hình dựa vào một dấu hiệu tình cờ thay vì đặc điểm thật.',
    'Giải thích vì sao dữ liệu Dạy cần đa dạng và tập Kiểm tra cần khác biệt.',
    'Dùng bằng chứng (ma trận nhầm lẫn, bản đồ 2D, nhật ký thí nghiệm) để tìm nguyên nhân và sửa lỗi.',
    'Liên hệ với rủi ro thiên lệch dữ liệu trong các hệ thống AI thực tế.',
  ],
  steps: [
    {
      title: 'Quan sát dữ liệu Dạy',
      body: [
        'Bấm "Tạo dự án mẫu cho bài này". Xem kỹ các ảnh ở ngăn Dạy của lớp "Hình tròn" và lớp "Hình vuông".',
        'Giáo viên chưa nói gì về "bẫy" — hãy để học sinh tự phát hiện.',
      ],
      predict: {
        question: 'Sau khi huấn luyện, em đoán điểm trên tập Kiểm tra sẽ khoảng bao nhiêu?',
        answer: 'Hãy ghi lại dự đoán, rồi huấn luyện để kiểm chứng.',
      },
    },
    {
      title: 'Huấn luyện và chấm điểm',
      body: [
        'Làm bước ③ Biểu diễn, rồi ④ Huấn luyện với tốc độ Bình thường.',
        'So sánh điểm trên bài đã học và bài chưa học. Xem Ma trận nhầm lẫn trên tập Kiểm tra và bấm vào các ô bị nhầm.',
      ],
      predict: {
        question: 'Vì sao điểm bài đã học rất cao mà điểm bài chưa học lại thấp?',
        answer:
          'Hãy so sánh NỀN của ảnh: lúc Dạy, hình tròn luôn trên nền sáng, hình vuông luôn trên nền tối. Ở tập Kiểm tra thì ngược lại. Mô hình đã học "nền sáng → tròn, nền tối → vuông" — một lối tắt dễ hơn việc nhận ra hình dạng.',
      },
      record: [
        { kind: 'fields', title: 'Em ghi lại', fields: ['Điểm Dạy:', 'Điểm Kiểm tra:'], answers: ['100%', '0%'] },
        {
          kind: 'confusion',
          title: 'Chép ma trận nhầm lẫn trên tập Kiểm tra (số ảnh)',
          // hàng = lớp thật (tròn, vuông), cột = lớp mô hình đoán
          answers: [
            [0, 6],
            [6, 0],
          ],
        },
      ],
    },
    {
      title: 'Tìm bằng chứng',
      body: [
        'Trên Bản đồ dữ liệu 2D, bấm vào các chấm bị khoanh vòng đỏ. Chúng nằm gần nhóm nào? Xem "ảnh Dạy giống nhất" của chúng có cùng hình dạng hay cùng màu nền?',
      ],
      record: [
        {
          kind: 'lines',
          title: '"Ảnh Dạy giống nhất" của một ảnh bị đoán sai thuộc lớp nào, có nền thế nào?',
          lines: 3,
          answer:
            'Ảnh Dạy giống nhất của một hình tròn bị đoán sai đều là HÌNH VUÔNG có cùng màu nền tối với nó. Với máy, màu nền quan trọng hơn hình dạng: đó là bằng chứng của lối tắt.',
        },
      ],
    },
    {
      title: 'Sửa dữ liệu và thí nghiệm lại',
      body: [
        'Ở mỗi lớp, chuyển 3 trong 6 ảnh Kiểm tra sang ngăn Dạy (nút ⇄ trên ảnh). Như vậy dữ liệu Dạy có cả nền sáng lẫn nền tối cho mỗi hình.',
        'Làm lại bước ③ nếu được nhắc, rồi huấn luyện lại. So sánh hai lần chạy trong Nhật ký thí nghiệm.',
      ],
      predict: {
        question: 'Điểm Kiểm tra sẽ thay đổi thế nào sau khi dữ liệu Dạy đa dạng hơn?',
        answer:
          'Điểm thường tăng, vì nền không còn luôn đi kèm một lớp nên mô hình phải dựa nhiều hơn vào hình dạng. Nhưng có thể vẫn chưa cao: 3 ảnh "nền ngược" so với 18 ảnh có bẫy vẫn là quá ít, và tập Kiểm tra chỉ còn 3 ảnh mỗi lớp nên điểm dao động mạnh. Muốn mô hình tốt hơn, cần thêm nhiều ảnh đa dạng hơn nữa.',
      },
      record: [
        {
          kind: 'table',
          title: 'So sánh hai lần chạy trong Nhật ký thí nghiệm',
          columns: ['Lần chạy', 'Điểm Dạy (%)', 'Điểm Kiểm tra (%)'],
          rows: ['Trước khi sửa', 'Sau khi sửa'],
          answers: [
            ['100', '0'],
            ['97,6', '66,7'],
          ],
        },
      ],
    },
    {
      title: 'Liên hệ thực tế',
      body: [
        'Đã có nghiên cứu cho thấy mô hình đọc phim X-quang học theo các ký hiệu riêng của từng bệnh viện in trên phim, thay vì dấu hiệu bệnh, nên hoạt động kém khi dùng ở bệnh viện khác.',
        'Một số hệ thống nhận diện khuôn mặt từng có độ chính xác thấp hơn rõ rệt với những nhóm người ít xuất hiện trong dữ liệu huấn luyện.',
        'Thảo luận: nếu một mô hình như vậy được dùng thật, ai có thể bị ảnh hưởng? Người làm AI cần kiểm tra những gì trước khi đưa vào sử dụng?',
      ],
    },
  ],
  quiz: [
    {
      question: '"Học lối tắt" là gì?',
      options: [
        'Mô hình học nhanh hơn nhờ máy tính mạnh',
        'Mô hình dựa vào một dấu hiệu tình cờ đi kèm dữ liệu thay vì đặc điểm thật của đối tượng',
        'Mô hình bỏ qua một số epoch',
      ],
      correct: 1,
      explanation: 'Trong bài, dấu hiệu tình cờ là màu nền; đặc điểm thật là hình dạng.',
    },
    {
      question: 'Cách nào giúp giảm học lối tắt?',
      options: [
        'Tăng số epoch thật nhiều',
        'Thu thập dữ liệu Dạy đa dạng để dấu hiệu tình cờ không còn đi kèm cố định với một lớp',
        'Bỏ tập Kiểm tra cho nhanh',
      ],
      correct: 1,
      explanation: 'Khi nền sáng và nền tối đều có ở cả hai lớp, màu nền không còn giúp đoán đúng.',
    },
    {
      question: 'Vì sao không thể chỉ nhìn điểm trên tập Dạy để kết luận mô hình tốt?',
      options: [
        'Vì mô hình có thể đạt điểm cao nhờ lối tắt chỉ đúng với dữ liệu đã học',
        'Vì điểm tập Dạy luôn bằng 0',
        'Vì tập Dạy quá nhỏ',
      ],
      correct: 0,
      explanation: 'Chỉ dữ liệu chưa thấy — và đủ khác biệt — mới cho biết mô hình có thật sự học đúng điều cần học.',
    },
  ],
  wrapUp:
    'Mô hình học bất cứ dấu hiệu nào giúp nó đoán đúng trên dữ liệu Dạy, kể cả dấu hiệu tình cờ. Vì vậy dữ liệu cần đa dạng, tập Kiểm tra cần khác biệt, và người làm AI phải chủ động tìm xem mô hình đang dựa vào điều gì.',
  teacherNotes: [
    'Không tiết lộ "bẫy nền" trước bước Huấn luyện để học sinh tự khám phá.',
    'Kết quả tái lập được: với cùng dữ liệu và cài đặt, các máy sẽ cho kết quả như nhau hoặc chỉ lệch rất nhỏ (do card đồ họa khác nhau tính số thực hơi khác).',
    'Đã kiểm chứng với MobileNetV2: lúc có bẫy, điểm Dạy khoảng 100% còn điểm Kiểm tra rất thấp (có thể 0%).',
    'Phần liên hệ thực tế có thể mở rộng thành thảo luận về trách nhiệm và công bằng trong AI.',
  ],
};
