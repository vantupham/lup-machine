/**
 * Nội dung Phòng đạo đức AI (tiếng Việt, như các bài học).
 * Mọi khẳng định về kết quả thí nghiệm ở đây đã được kiểm tra trên 10 lần lấy mẫu
 * (src/core/ethics/rice-leaves.test.ts); con số cụ thể hiển thị lấy thẳng từ lần chạy trên trang.
 */

export interface BiasStepContent {
  readonly title: string;
  readonly action: string;
  readonly explain: string;
  readonly takeaway: string;
}

export const BIAS_INTRO = {
  title: 'Thí nghiệm: AI có công bằng với mọi vùng?',
  story:
    'Một nhóm bạn làm AI đoán lá lúa bị bệnh hay khỏe từ hai số đo: độ vàng của lá và số đốm trên lá. Họ thu lá chủ yếu ở Đồng bằng (200 lá), chỉ có 20 lá ở Miền núi. Giả sử ở Miền núi trời lạnh hơn nên lá lúa khỏe cũng vàng hơn lá Đồng bằng.',
  dataNote: 'Dữ liệu giả lập theo seed để thí nghiệm tái lập được, không phải số đo thật. Ngăn Kiểm tra có 100 lá mỗi vùng.',
} as const;

export const BIAS_STEPS: readonly BiasStepContent[] = [
  {
    title: '① Huấn luyện với dữ liệu lệch',
    action: 'Huấn luyện',
    explain: 'Mô hình hồi quy logistic chỉ nhìn hai số đo, không biết lá ở vùng nào.',
    takeaway:
      'Độ chính xác chung trông khá ổn, nhưng tách theo vùng mới thấy Miền núi kém hẳn. Mọi lỗi ở Miền núi đều là báo động nhầm: lá khỏe bị báo bệnh. Nguyên nhân là độ vàng: mô hình gần như chỉ học từ lá Đồng bằng, nên với nó "vàng" nghĩa là "bệnh". Nếu lá Miền núi khỏe không vàng hơn, phần lớn báo động nhầm sẽ biến mất. Một con số "chung" có thể che giấu việc AI làm kém với một nhóm.',
  },
  {
    title: '② Thu thêm dữ liệu Miền núi',
    action: 'Thu thêm 200 lá Miền núi rồi huấn luyện lại',
    explain: 'Dữ liệu Dạy giờ có số lá hai vùng gần bằng nhau. Mô hình vẫn không biết lá ở vùng nào.',
    takeaway:
      'Miền núi tốt lên, nhưng Đồng bằng lại giảm, và phần giảm đó đúng bằng số lá bệnh Đồng bằng bị bỏ sót thêm. Mô hình chỉ có một đường ranh giới cho cả hai vùng nên phải "chia" lỗi cho hai vùng. Thêm dữ liệu là cần thiết nhưng chưa đủ.',
  },
  {
    title: '③ Cho mô hình biết lá ở vùng nào',
    action: 'Thêm cột "ở Miền núi" rồi huấn luyện lại',
    explain: 'Mô hình có thêm một cột 0/1 cho biết lá ở Miền núi. Mỗi vùng giờ có một đường ranh giới riêng.',
    takeaway:
      'Cả hai vùng đều đúng từ 90% trở lên. Nhưng hãy nghĩ kỹ: nguyên nhân thật là trời lạnh, "ở Miền núi" chỉ là cột thay thế; một cột tốt hơn là nhiệt độ nơi trồng lúa. Với con người thì càng phải cẩn thận: những cột như giới tính, dân tộc, nơi ở có thể làm mô hình "chính xác hơn" nhưng cũng có thể dẫn tới phân biệt đối xử. Chính xác hơn chưa phải là lý do đủ; việc dùng những thông tin này thường bị pháp luật hạn chế và phải có người chịu trách nhiệm.',
  },
];

export const BIAS_PREDICT = {
  question: 'Trước khi tách theo vùng, em đoán: mô hình đúng với lá Miền núi nhiều hơn, bằng, hay ít hơn con số chung?',
  options: ['Nhiều hơn', 'Gần bằng', 'Ít hơn'],
  answerIndex: 2,
  reveal: 'Xem độ chính xác theo từng vùng',
} as const;

export interface DataFlowItem {
  readonly where: string;
  readonly what: string;
}

export const DATA_FLOW = {
  title: 'Dữ liệu của em đi đâu?',
  lead: 'LUP Machine không có máy chủ nhận dữ liệu của em. Mọi thứ em làm nằm trên máy em, cho tới khi chính em bấm "Xuất" và tự gửi tệp cho ai đó.',
  stays: [
    { where: 'Trình duyệt của máy này (IndexedDB)', what: 'Ảnh, âm thanh, tọa độ khớp, bảng dữ liệu, nhật ký huấn luyện, thẻ mô hình, bài tập và bài nộp mà em đã thêm.' },
    { where: 'Camera và micro', what: 'Chỉ bật khi em cho phép, tắt khi em rời trang. Hình và tiếng chỉ được lưu (vào dòng trên) khi em bấm thêm mẫu.' },
    { where: 'Bộ nhớ đệm ngoại tuyến của trình duyệt', what: 'Bản sao mã trang, mô hình và bộ dữ liệu mẫu để dùng được khi mất mạng. Không chứa dữ liệu của em.' },
  ] satisfies readonly DataFlowItem[],
  downloads: [
    { where: 'Từ trang web (GitHub Pages)', what: 'Mã của trang và các mô hình có sẵn (MobileNet, MoveNet…). Như mọi trang web, máy chủ biết có một máy vừa tải trang (địa chỉ IP), nhưng không nhận dữ liệu em tạo ra.' },
  ] satisfies readonly DataFlowItem[],
  leaves: [
    { where: 'Tệp .lup / .lups / .ipynb / .xlsx', what: 'Chỉ khi em bấm "Xuất" hoặc "Nộp bài". Tệp nằm trên máy em; em tự quyết định gửi cho ai, qua đâu.' },
  ] satisfies readonly DataFlowItem[],
  never: 'Không có: tài khoản, cookie theo dõi, công cụ phân tích, máy chủ lưu dữ liệu của em.',
  tips: [
    'Bài nộp mặc định không kèm ảnh, giọng nói gốc. Chỉ kèm khi thầy cô yêu cầu.',
    'Trước khi chụp ảnh hay ghi âm bạn bè, hãy xin phép. Ghi điều đó vào Thẻ mô hình.',
    'Máy dùng chung ở phòng tin: xóa dự án khi làm xong, hoặc xuất tệp .lup để mang về.',
  ],
} as const;

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly situation: string;
  readonly questions: readonly string[];
}

export const SCENARIOS_TITLE = 'Tình huống thảo luận';
export const SCENARIOS_LEAD = 'Không có đáp án duy nhất. Hãy thảo luận theo nhóm, rồi liên hệ với dự án em vừa làm: ghi điều em nghĩ vào câu 4 và câu 5 của Thẻ mô hình.';

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'face-gate',
    title: 'Điểm danh bằng khuôn mặt ở cổng trường',
    situation: 'Trường định lắp camera nhận diện khuôn mặt để điểm danh tự động. Nhà cung cấp nói hệ thống "chính xác 98%".',
    questions: [
      '98% là đúng với ai? Nếu hệ thống chủ yếu được thử với người lớn, nó có đúng với học sinh lớp 6 không?',
      'Một bạn bị nhận nhầm là vắng mặt: ai chịu trách nhiệm, bạn ấy khiếu nại thế nào?',
      'Ảnh khuôn mặt học sinh được lưu ở đâu, bao lâu, ai được xem?',
    ],
  },
  {
    id: 'essay-grader',
    title: 'Máy chấm bài văn',
    situation: 'Một phần mềm chấm điểm bài văn được huấn luyện từ các bài văn mẫu đạt điểm cao những năm trước.',
    questions: [
      'Bài văn sáng tạo, khác hẳn văn mẫu, có bị chấm thấp không? Vì sao?',
      'Học sinh có nên biết bài mình được máy chấm? Có quyền đề nghị thầy cô chấm lại không?',
      'Nên dùng máy để chấm điểm, hay chỉ để gợi ý lỗi chính tả cho học sinh tự sửa?',
    ],
  },
  {
    id: 'traffic-camera',
    title: 'Camera phạt nguội',
    situation: 'Camera đọc biển số xe để gửi thông báo phạt. Biển số bẩn hoặc trời mưa thì máy có thể đọc sai một ký tự.',
    questions: [
      'Khi máy đọc nhầm, ai bị ảnh hưởng? Họ có biết để khiếu nại không?',
      'Có nên để người kiểm tra lại trước khi gửi thông báo phạt?',
      'Giống thí nghiệm lá lúa: điều kiện nào (mưa, đêm, biển cũ) có thể làm máy kém đi mà con số "chính xác chung" không cho thấy?',
    ],
  },
  {
    id: 'career-advisor',
    title: 'Ứng dụng gợi ý chọn ngành',
    situation: 'Một ứng dụng gợi ý ngành học từ điểm số và giới tính, học từ dữ liệu tuyển sinh nhiều năm trước.',
    questions: [
      'Nếu ngày xưa ít nữ học kỹ thuật, ứng dụng có thể gợi ý điều gì cho một bạn nữ giỏi Toán?',
      'Có nên cho ứng dụng biết giới tính? So sánh với cột "ở Miền núi" trong thí nghiệm lá lúa: khác nhau ở đâu?',
      'Ai nên được quyết định cuối cùng: ứng dụng, thầy cô, phụ huynh hay chính học sinh?',
    ],
  },
];
