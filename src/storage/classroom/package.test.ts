import { strToU8, unzipSync, zipSync } from 'fflate';
import { encodeBundle, type ProjectBundle } from '../project-file/bundle';
import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';
import type { Submission } from '../schemas/assignment';
import { sampleAssignment } from '../../../tests/setup/sample-assignment';
import { fakeJpeg } from '../../../tests/setup/fake-images';
import {
  ClassroomFileError,
  decodeAssignmentPackage,
  decodeSubmissionPackage,
  encodeAssignmentPackage,
  encodeSubmissionPackage,
} from './package';

const meta = { appVersion: '0.1.0', createdAt: '2026-11-24T08:00:00.000Z' };

const starter: ProjectBundle = {
  manifest: { formatVersion: CURRENT_FORMAT_VERSION, appVersion: '0.1.0', projectType: 'image', name: 'Mẫu', createdAt: meta.createdAt },
  classes: ['Giấy', 'Nhựa'],
  images: [{ classIndex: 0, split: 'train', source: 'upload', image: { bytes: fakeJpeg(1).buffer as ArrayBuffer, mime: 'image/jpeg', width: 224, height: 224 } }],
  clips: [],
  poses: [],
  table: null,
  runs: [],
  modelCard: null,
  notes: [],
  trials: [],
};

const submission: Submission = {
  assignment: sampleAssignment,
  submitter: { students: 'An, Bình', className: '7A' },
  answers: ['Giấy với nhựa', 'Chụp thêm'],
  submittedAt: '2026-11-25T10:00:00.000Z',
  includesData: false,
  summary: { projectType: 'image', classes: [{ name: 'Giấy', count: 1, train: 1, test: 0 }], table: null, latestRun: null },
};

function rezip(bytes: Uint8Array, change: (files: Record<string, Uint8Array>) => void): Uint8Array {
  const files = unzipSync(bytes);
  change(files);
  return zipSync(files);
}

describe('gói bài tập .lupa', () => {
  test('không có dự án mẫu', () => {
    const decoded = decodeAssignmentPackage(encodeAssignmentPackage({ assignment: sampleAssignment, starter: null }, meta));
    expect(decoded).toEqual({ assignment: sampleAssignment, starter: null });
  });

  test('có dự án mẫu lồng bên trong dưới dạng project.lup', () => {
    const bytes = encodeAssignmentPackage({ assignment: sampleAssignment, starter }, meta);
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual(['assignment.json', 'manifest.json', 'project.lup']);
    const decoded = decodeAssignmentPackage(bytes);
    expect(decoded.starter?.classes).toEqual(['Giấy', 'Nhựa']);
    expect(decoded.starter?.images).toHaveLength(1);
  });

  test('dự án mẫu khác loại với bài tập thì từ chối', () => {
    const bytes = encodeAssignmentPackage({ assignment: { ...sampleAssignment, projectType: 'audio' }, starter }, meta);
    expect(() => decodeAssignmentPackage(bytes)).toThrow(/loại dự án/);
  });

  test('mở nhầm bài nộp hay tệp .lup thì báo rõ', () => {
    expect(() => decodeAssignmentPackage(encodeSubmissionPackage({ submission, project: starter }, meta))).toThrow(/không phải gói bài tập/);
    expect(() => decodeAssignmentPackage(encodeBundle(starter))).toThrow(/không phải gói bài tập/);
  });

  test('đề bài không hợp lệ', () => {
    const broken = rezip(encodeAssignmentPackage({ assignment: sampleAssignment, starter: null }, meta), (files) => {
      files['assignment.json'] = strToU8(JSON.stringify({ ...sampleAssignment, rubric: [] }));
    });
    expect(() => decodeAssignmentPackage(broken)).toThrow(ClassroomFileError);
  });

  test('định dạng mới hơn ứng dụng', () => {
    const broken = rezip(encodeAssignmentPackage({ assignment: sampleAssignment, starter: null }, meta), (files) => {
      files['manifest.json'] = strToU8(JSON.stringify({ format: 'lup-assignment', formatVersion: 99, ...meta }));
    });
    expect(() => decodeAssignmentPackage(broken)).toThrow(/manifest/);
  });

  test('dự án mẫu hỏng thì báo lỗi kèm tên tệp', () => {
    const broken = rezip(encodeAssignmentPackage({ assignment: sampleAssignment, starter }, meta), (files) => {
      files['project.lup'] = strToU8('hỏng');
    });
    expect(() => decodeAssignmentPackage(broken)).toThrow(/project\.lup/);
  });

  test('không phải tệp zip', () => {
    expect(() => decodeAssignmentPackage(strToU8('xin chào'))).toThrow(ClassroomFileError);
  });
});

describe('bài nộp .lups', () => {
  test('ghi rồi đọc lại đủ thông tin và dự án', () => {
    const decoded = decodeSubmissionPackage(encodeSubmissionPackage({ submission, project: starter }, meta));
    expect(decoded.submission).toEqual(submission);
    expect(decoded.project.classes).toEqual(['Giấy', 'Nhựa']);
  });

  test('câu trả lời không khớp số câu hỏi thì từ chối', () => {
    const bytes = encodeSubmissionPackage({ submission: { ...submission, answers: ['một câu'] }, project: starter }, meta);
    expect(() => decodeSubmissionPackage(bytes)).toThrow(/câu trả lời/);
  });

  test('thiếu dự án', () => {
    const broken = rezip(encodeSubmissionPackage({ submission, project: starter }, meta), (files) => delete files['project.lup']);
    expect(() => decodeSubmissionPackage(broken)).toThrow(/project\.lup/);
  });

  test('dự án khác loại với bài tập', () => {
    const bytes = encodeSubmissionPackage({ submission: { ...submission, assignment: { ...sampleAssignment, projectType: 'text' } }, project: starter }, meta);
    expect(() => decodeSubmissionPackage(bytes)).toThrow(/loại dự án/);
  });

  test('mở nhầm gói bài tập', () => {
    expect(() => decodeSubmissionPackage(encodeAssignmentPackage({ assignment: sampleAssignment, starter: null }, meta))).toThrow(/không phải bài nộp/);
  });
});
