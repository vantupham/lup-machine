import type { Lesson } from './types';

export const lessonPlantDisease: Lesson = {
  id: 'bac-si-cay-trong',
  grade: '8–12',
  minutes: 45,
  title: 'AI làm bác sĩ cây trồng',
  summary:
    'Dùng ảnh lá đậu chụp thật ngoài đồng để dạy máy phát hiện bệnh cây. Dữ liệu thật khó hơn hình vẽ: mô hình mắc lỗi gì, lỗi nào nguy hiểm nhất với nông dân, và khi nào AI nên nói "tôi không chắc"?',
  dataset: 'beans-3',
  goals: [
    'Thấy sự khác biệt giữa dữ liệu thật (đa dạng, nhiễu, các lớp giống nhau) và dữ liệu đơn giản.',
    'Nhận ra hiện tượng quá khớp: điểm Dạy rất cao nhưng điểm Kiểm tra thấp hơn nhiều, và huấn luyện thêm không giúp được.',
    'Đọc ma trận nhầm lẫn để tìm lỗi hay gặp nhất, và đánh giá lỗi nào gây hại nhiều nhất trong thực tế.',
    'Dùng ngưỡng tin cậy để AI chỉ trả lời khi đủ chắc, phần còn lại chuyển cho chuyên gia.',
  ],
  steps: [
    {
      title: 'Bối cảnh: bác sĩ cho cây đậu',
      body: [
        'Ở Uganda, nhiều nông hộ nhỏ trồng đậu, một nguồn đạm quan trọng cho trẻ em. Phòng thí nghiệm AI của Đại học Makerere cùng Viện Nghiên cứu Cây trồng Quốc gia Uganda đã chụp lá đậu ngoài đồng bằng điện thoại phổ thông, rồi nhờ chuyên gia gắn nhãn bệnh. Mục tiêu: một mô hình chạy trên điện thoại giúp nông dân phát hiện bệnh.',
        'Bấm "Tạo dự án mẫu cho bài này". Có 3 lớp: Lá khỏe, Bệnh đốm góc (vết nâu có cạnh góc cạnh, thường bị gân lá chặn lại) và Bệnh gỉ sắt (nhiều chấm nhỏ màu nâu đỏ như gỉ, hay có quầng vàng).',
        'Bấm "Soi ảnh" vài ảnh mỗi lớp để nhìn kỹ vết bệnh. Mỗi ảnh đều ghi nguồn và giấy phép.',
      ],
      predict: {
        question: 'Theo em, máy sẽ khó phân biệt cặp lớp nào nhất?',
        answer: 'Hãy ghi lại dự đoán. Nhiều người đoán là hai bệnh, vì cả hai đều là đốm nâu trên lá xanh. Ta sẽ kiểm chứng bằng ma trận nhầm lẫn ở bước 4.',
      },
    },
    {
      title: 'Nhìn dữ liệu bằng con mắt của máy',
      body: [
        'Làm bước 3 (Biểu diễn) rồi xem Bản đồ dữ liệu 2D. Thử chuyển sang UMAP.',
        'So sánh với bản đồ của bộ "Tròn hay vuông?" hoặc bộ hoa nếu lớp em đã làm: các nhóm ở đây có tách bạch không?',
      ],
      predict: {
        question: 'Ba lớp lá đậu có tách thành ba nhóm rõ ràng trên bản đồ không?',
        answer:
          'Thường là không: các chấm của ba lớp, nhất là hai lớp bệnh, nằm xen vào nhau. Ảnh chụp ngoài đồng có nền đất, cỏ, bàn tay, ánh nắng khác nhau, nên những điểm khác biệt nhỏ của vết bệnh bị lẫn giữa rất nhiều điều khác.',
      },
    },
    {
      title: 'Huấn luyện: mô hình học thuộc bài',
      body: [
        'Huấn luyện với cài đặt mặc định. So sánh điểm trên bài đã học (Dạy) và bài chưa học (Kiểm tra). Đọc cảnh báo hiện ra.',
        'Kéo thanh "Phát lại" từ epoch 0 đến 50 và quan sát hai đường trên biểu đồ độ chính xác.',
        'Lưu ý: tập Kiểm tra chỉ có 18 ảnh, nên mỗi ảnh đúng hay sai làm điểm thay đổi khoảng 5,6%.',
      ],
      predict: {
        question: 'Nếu huấn luyện lâu hơn nữa (nhiều epoch hơn), điểm Kiểm tra có tăng lên không?',
        answer:
          'Không đáng kể. Điểm Dạy tăng dần lên 100% (mô hình nhớ hết 72 ảnh đã học), nhưng điểm Kiểm tra chỉ dừng quanh 70–80% từ khá sớm. Đó là quá khớp: học thuộc bài chứ chưa hiểu bài. Cách chữa thật sự là có thêm nhiều ảnh đa dạng hơn, không phải học lâu hơn.',
      },
      record: [
        {
          kind: 'table',
          title: 'Kéo thanh "Phát lại" tới từng epoch và ghi điểm',
          columns: ['Epoch', 'Điểm Dạy (%)', 'Điểm Kiểm tra (%)'],
          rows: ['0', '10', '50'],
          answers: [
            ['37,5', '44,4'],
            ['97,2', '72,2'],
            ['100', '72,2'],
          ],
        },
      ],
    },
    {
      title: 'Lỗi nào nguy hiểm nhất?',
      body: [
        'Ở bước 5 (Đánh giá), xem Ma trận nhầm lẫn trên tập Kiểm tra. Bấm vào các ô ngoài đường chéo để xem những ảnh bị đoán sai.',
        'Thảo luận theo nhóm: với người nông dân, đoán nhầm "bệnh này thành bệnh kia" và đoán nhầm "lá bệnh thành lá khỏe", lỗi nào gây hại hơn?',
        'Chế độ Chuyên sâu: xem bảng precision / recall. Recall của một lớp bệnh cho biết trong số lá thật sự mắc bệnh đó, mô hình phát hiện được bao nhiêu phần.',
      ],
      predict: {
        question: 'Cặp lớp nào bị nhầm nhiều nhất? Có lá bệnh nào bị đoán là khỏe không?',
        answer:
          'Thường gặp nhất là lá gỉ sắt bị đoán thành đốm góc: hai bệnh đều tạo đốm nâu. Lá bệnh bị đoán là khỏe thì hiếm hoặc không có. Đây là điều tốt, vì bỏ sót bệnh (nông dân không chữa, bệnh lây lan) thường nguy hiểm hơn nhầm tên bệnh.',
      },
      record: [
        {
          kind: 'confusion',
          title: 'Chép ma trận nhầm lẫn trên tập Kiểm tra (số ảnh)',
          // hàng = lớp thật (khỏe, đốm góc, gỉ sắt), cột = lớp mô hình đoán
          answers: [
            [5, 0, 1],
            [0, 5, 1],
            [0, 3, 3],
          ],
        },
        {
          kind: 'fields',
          title: 'Em rút ra',
          fields: ['Cặp lớp bị nhầm nhiều nhất:', 'Số lá bệnh bị đoán là "Lá khỏe":'],
          answers: ['Bệnh gỉ sắt bị đoán là Bệnh đốm góc (3 ảnh)', '0'],
        },
      ],
    },
    {
      title: 'Mô hình nhìn vào đâu?',
      body: [
        'Bấm vào một chấm có vòng đỏ (ảnh bị đoán sai) trên bản đồ. Xem "Mô hình nhìn vào đâu?" và bấm "Đo bằng cách che từng ô".',
        'Vùng đỏ nằm trên các vết bệnh, hay trên bàn tay, đất, cỏ? Nhiều ảnh trong bộ này có bàn tay cầm lá: nếu mô hình dựa vào những thứ đó, nó có đang "học nhầm" như bài 3 không?',
      ],
      record: [
        {
          kind: 'lines',
          title: 'Vùng đỏ nằm ở đâu trên ảnh em chọn? Em nghĩ gì về điều đó?',
          lines: 3,
          answer:
            'Câu hỏi mở, mỗi ảnh một khác. Khen học sinh nào so sánh cả hai bản đồ (nhìn vào đâu và che thử từng ô), chỉ ra được vùng đỏ nằm trên vết bệnh hay trên bàn tay, đất, và nối với bài 3: nếu mô hình dựa vào thứ không phải vết bệnh thì đó là dấu hiệu học lối tắt.',
        },
      ],
    },
    {
      title: 'AI biết nói "tôi không chắc"',
      body: [
        'Ở phần Ngưỡng tin cậy, kéo ngưỡng từ 50% lên 90%. Đọc dòng tóm tắt: mô hình trả lời bao nhiêu ảnh, và đúng bao nhiêu phần trong số đó?',
        'Hình dung một ứng dụng thật: ảnh nào mô hình chắc từ 90% trở lên thì trả lời ngay; ảnh còn lại báo "chưa chắc, hãy hỏi cán bộ khuyến nông".',
      ],
      predict: {
        question: 'Khi nâng ngưỡng lên 90%, chuyện gì xảy ra với số ảnh được trả lời và độ chính xác?',
        answer:
          'Mô hình trả lời ít ảnh hơn (khoảng một nửa), nhưng trong số đó đúng nhiều hơn hẳn (khoảng 90%). Đây là sự đánh đổi: muốn đáng tin hơn thì phải chấp nhận để con người xử lý những trường hợp khó.',
      },
      record: [
        {
          kind: 'table',
          title: 'Kéo ngưỡng tin cậy và ghi kết quả',
          columns: ['Ngưỡng', 'Số ảnh được trả lời (trên 18)', 'Đúng (%)'],
          rows: ['50%', '70%', '90%'],
          answers: [
            ['18', '72'],
            ['13', '85'],
            ['10', '90'],
          ],
        },
      ],
    },
    {
      title: 'Làm sao để bác sĩ AI giỏi hơn?',
      body: [
        'Thảo luận: nhóm em sẽ làm gì để mô hình tốt hơn? Gợi ý: thêm nhiều ảnh hơn (bộ gốc có khoảng 1.300 ảnh, ta mới dùng 90), chụp nhiều điều kiện ánh sáng và nhiều loại điện thoại, chụp cả khi không có bàn tay, nhờ chuyên gia kiểm tra nhãn.',
        'Mô hình học từ lá đậu ở Uganda có dùng ngay được cho cây trồng ở địa phương em không? Cần kiểm tra những gì trước khi đưa cho nông dân dùng?',
      ],
      record: [
        {
          kind: 'lines',
          title: 'Ý tưởng của nhóm em để bác sĩ AI giỏi hơn',
          lines: 4,
          answer:
            'Ý tưởng tốt: thêm nhiều ảnh mỗi lớp; chụp nhiều nơi, nhiều giờ trong ngày, nhiều loại điện thoại; có ảnh không có bàn tay; chuyên gia kiểm tra lại nhãn; thử trên ảnh từ ruộng khác trước khi dùng; cho AI trả lời "không chắc" khi độ tin cậy thấp.',
        },
      ],
    },
  ],
  quiz: [
    {
      question: 'Mô hình đạt 100% điểm Dạy nhưng chỉ khoảng 72% điểm Kiểm tra. Điều đó cho thấy gì?',
      options: [
        'Mô hình đã hoàn hảo',
        'Mô hình quá khớp: nhớ rất tốt ảnh đã học nhưng chưa làm tốt với ảnh mới',
        'Tập Kiểm tra bị gắn nhãn sai hết',
      ],
      correct: 1,
      explanation: 'Khoảng cách lớn giữa điểm Dạy và điểm Kiểm tra là dấu hiệu quá khớp. Điểm trên ảnh chưa thấy mới cho biết mô hình dùng được thật hay không.',
    },
    {
      question: 'Với ứng dụng phát hiện bệnh cây, lỗi nào thường nguy hiểm nhất?',
      options: [
        'Đoán lá khỏe thành lá bệnh',
        'Đoán lá bệnh thành lá khỏe',
        'Đoán đúng nhưng chậm',
      ],
      correct: 1,
      explanation: 'Bỏ sót bệnh khiến nông dân không xử lý kịp, bệnh có thể lây sang cả ruộng. Báo nhầm lá khỏe là bệnh thì chỉ tốn công kiểm tra lại.',
    },
    {
      question: 'Vì sao nên đặt ngưỡng tin cậy cho mô hình?',
      options: [
        'Để mô hình chạy nhanh hơn',
        'Để mô hình chỉ trả lời khi đủ chắc; trường hợp khó chuyển cho con người',
        'Để điểm Dạy tăng lên',
      ],
      correct: 1,
      explanation: 'Ngưỡng cao làm mô hình trả lời ít hơn nhưng đúng hơn. AI là trợ lý, chuyên gia vẫn quyết định ở những ca khó.',
    },
    {
      question: 'Cách nào giúp mô hình chẩn đoán bệnh cây tốt hơn nhiều nhất?',
      options: [
        'Huấn luyện thêm thật nhiều epoch trên 72 ảnh hiện có',
        'Thu thêm nhiều ảnh đa dạng, được chuyên gia gắn nhãn đúng',
        'Bỏ tập Kiểm tra đi để có thêm ảnh Dạy',
      ],
      correct: 1,
      explanation: 'Học lâu hơn trên ít ảnh chỉ làm mô hình học thuộc thêm. Dữ liệu nhiều và đa dạng mới giúp mô hình nhận ra đặc điểm thật của từng bệnh.',
    },
  ],
  wrapUp:
    'Với dữ liệu thật, mô hình dễ học thuộc những ảnh đã thấy mà chưa làm tốt với ảnh mới. Người làm AI phải nhìn vào điểm trên dữ liệu chưa thấy, tìm xem lỗi nào gây hại nhất, và thiết kế để AI biết nói "không chắc", nhường quyết định khó cho con người.',
  teacherNotes: [
    'Đã kiểm chứng với MobileNetV2 (cài đặt mặc định): điểm Dạy 100%, điểm Kiểm tra khoảng 72% (13/18 ảnh); cảnh báo quá khớp hiện ra.',
    'Lỗi hay gặp nhất là lá gỉ sắt bị đoán thành đốm góc (3/6 ảnh gỉ sắt trong lần chạy kiểm chứng); không có lá bệnh nào bị đoán là khỏe. Ở ngưỡng 90%, mô hình trả lời 10/18 ảnh và đúng 90%.',
    'Kết quả có thể lệch rất nhỏ giữa các máy (card đồ họa tính số thực hơi khác). Tập Kiểm tra chỉ 18 ảnh, nên mỗi ảnh tương đương khoảng 5,6 điểm phần trăm: nhắc học sinh không kết luận quá mạnh từ chênh lệch 1 ảnh.',
    'Bước "Mô hình nhìn vào đâu?" là câu hỏi mở: hãy để học sinh tự quan sát và tranh luận, không có đáp án duy nhất.',
    'Ảnh từ bộ dữ liệu ibean (MIT, AIR Lab, Đại học Makerere, Uganda). Có thể mở rộng: học sinh tự chụp lá cây ở trường (không chụp người) để làm bộ dữ liệu riêng.',
  ],
};
