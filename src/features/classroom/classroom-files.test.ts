import { createTestRepository, type TestRepositories } from '../../../tests/setup/render';
import { fakeStoredJpeg } from '../../../tests/setup/fake-images';
import { sampleAssignment } from '../../../tests/setup/sample-assignment';
import { decodeAssignmentPackage, decodeSubmissionPackage } from '@/storage/classroom/package';
import type { AssignmentDraft } from '@/storage/schemas/assignment';
import { datasetFingerprint } from '@/core/data/fingerprint';
import {
  createAssignmentFile,
  createSubmissionFile,
  openAssignmentFile,
  SubmissionBlockedError,
  submissionBlockers,
  type ClassroomRepositories,
} from './classroom-files';

const deps = { now: () => '2026-11-24T08:00:00.000Z', newId: () => '0d6f6e2a-1c1b-4d7e-8f9a-2b3c4d5e6f70' };
const draft: AssignmentDraft = {
  title: sampleAssignment.title,
  teacher: sampleAssignment.teacher,
  instructions: sampleAssignment.instructions,
  projectType: 'image',
  questions: sampleAssignment.questions,
  rubric: sampleAssignment.rubric,
};
const card = { authors: 'An', purpose: 'a', data: 'b', performance: 'c', limitations: 'd', misuse: 'e' };

function repos(r: TestRepositories): ClassroomRepositories {
  return { ...r, projects: r.repository };
}

async function makeImageProject(r: TestRepositories, name = 'Mẫu của cô') {
  const project = await r.repository.create({ name, projectType: 'image' });
  const cls = await r.dataset.addClass(project.id, 'Giấy');
  await r.dataset.addSamples([{ projectId: project.id, classId: cls.id, split: 'train', source: 'upload', image: fakeStoredJpeg(1) }]);
  return project;
}

describe('giáo viên tạo gói bài tập', () => {
  test('không kèm dự án mẫu: tên tệp theo tên bài, có mã và ngày tạo', async () => {
    const file = await createAssignmentFile(repos(createTestRepository()), draft, null, deps);
    expect(file.fileName).toBe('phan-loai-rac-bang-anh.lupa');
    expect(decodeAssignmentPackage(file.bytes)).toEqual({ assignment: { ...draft, id: deps.newId(), createdAt: deps.now() }, starter: null });
  });

  test('kèm dự án mẫu: có dữ liệu, KHÔNG kèm thẻ mô hình của giáo viên', async () => {
    const r = createTestRepository();
    const starter = await makeImageProject(r);
    await r.modelCards.save(starter.id, card);
    const { starter: bundle } = decodeAssignmentPackage((await createAssignmentFile(repos(r), draft, starter.id, deps)).bytes);
    expect(bundle?.classes).toEqual(['Giấy']);
    expect(bundle?.images).toHaveLength(1);
    expect(bundle?.modelCard).toBeNull();
    expect(bundle?.manifest.name).toBe(draft.title);
  });

  test('dự án mẫu khác loại thì báo lỗi; đề bài thiếu rubric thì báo lỗi', async () => {
    const r = createTestRepository();
    const starter = await makeImageProject(r);
    await expect(createAssignmentFile(repos(r), { ...draft, projectType: 'audio' }, starter.id, deps)).rejects.toThrow(/không đúng loại/);
    await expect(createAssignmentFile(repos(r), { ...draft, rubric: [] }, null, deps)).rejects.toThrow();
  });
});

describe('học sinh mở gói bài tập', () => {
  test('không có dự án mẫu: dự án ảnh trống với 2 lớp mặc định, gắn bài tập', async () => {
    const teacher = createTestRepository();
    const file = await createAssignmentFile(repos(teacher), draft, null, deps);
    const student = createTestRepository();
    const project = await openAssignmentFile(repos(student), file.bytes, ['Lớp 1', 'Lớp 2'], deps);
    expect(project).toMatchObject({ name: draft.title, projectType: 'image' });
    expect((await student.dataset.listClasses(project.id)).map((c) => c.name)).toEqual(['Lớp 1', 'Lớp 2']);
    expect((await student.assignments.get(project.id))?.assignment.id).toBe(deps.newId());
  });

  test('dự án văn bản trống không có lớp; dự án mẫu thì chép đủ dữ liệu', async () => {
    const teacher = createTestRepository();
    const student = createTestRepository();
    const text = await openAssignmentFile(repos(student), (await createAssignmentFile(repos(teacher), { ...draft, projectType: 'text' }, null, deps)).bytes, ['x'], deps);
    expect(await student.dataset.listClasses(text.id)).toEqual([]);

    const starter = await makeImageProject(teacher);
    const withStarter = await openAssignmentFile(repos(student), (await createAssignmentFile(repos(teacher), draft, starter.id, deps)).bytes, ['x'], deps);
    expect(await student.dataset.listSamples(withStarter.id)).toHaveLength(1);
    expect(await student.assignments.get(withStarter.id)).not.toBeNull();
  });
});

describe('học sinh nộp bài', () => {
  async function studentProject() {
    const teacher = createTestRepository();
    const starter = await makeImageProject(teacher);
    const student = createTestRepository();
    const file = await createAssignmentFile(repos(teacher), draft, starter.id, deps);
    const project = await openAssignmentFile(repos(student), file.bytes, [], deps);
    return { student, project };
  }

  test('chưa đủ điều kiện: thiếu tên, thẻ mô hình, câu trả lời', async () => {
    const { student, project } = await studentProject();
    expect(await submissionBlockers(repos(student), project.id, { students: ' ', className: '' })).toEqual(['students', 'model-card', 'answers']);
    await expect(createSubmissionFile(repos(student), project.id, { students: 'An', className: '7A' }, false, deps)).rejects.toBeInstanceOf(SubmissionBlockedError);
  });

  test('đủ điều kiện, không kèm dữ liệu gốc: chỉ có lớp, số liệu, câu trả lời và thẻ', async () => {
    const { student, project } = await studentProject();
    await student.modelCards.save(project.id, card);
    await student.assignments.saveAnswers(project.id, ['Giấy và nhựa', 'Chụp thêm']);
    const file = await createSubmissionFile(repos(student), project.id, { students: 'Nguyễn An', className: '7A' }, false, deps);
    expect(file.fileName).toBe('phan-loai-rac-bang-anh-nguyen-an.lups');
    const { submission, project: bundle } = decodeSubmissionPackage(file.bytes);
    expect(submission).toMatchObject({
      submitter: { students: 'Nguyễn An', className: '7A' },
      answers: ['Giấy và nhựa', 'Chụp thêm'],
      includesData: false,
      summary: { projectType: 'image', classes: [{ name: 'Giấy', count: 1, train: 1, test: 0 }] },
    });
    expect(bundle.images).toEqual([]);
    expect(bundle.classes).toEqual(['Giấy']);
    expect(bundle.modelCard).toEqual(card);
  });

  test('không kèm dữ liệu: số liệu không được nói lần huấn luyện "chạy lại được"', async () => {
    const { student, project } = await studentProject();
    await student.modelCards.save(project.id, card);
    await student.assignments.saveAnswers(project.id, ['a', 'b']);
    const classes = await student.dataset.listClasses(project.id);
    await student.experiments.addRun({
      projectId: project.id,
      fingerprint: datasetFingerprint(classes.map((c) => c.id), await student.dataset.listSamples(project.id)),
      options: { epochs: 5, learningRate: 0.01, batchSize: 8, seed: 1 },
      classNames: ['Giấy', 'Nhựa'],
      counts: { train: 1, test: 0 },
      metrics: [{ epoch: 1, trainLoss: 0.1, trainAccuracy: 1, testLoss: null, testAccuracy: null }],
    });
    const submitter = { students: 'An', className: '' };
    const stripped = decodeSubmissionPackage((await createSubmissionFile(repos(student), project.id, submitter, false, deps)).bytes);
    expect(stripped.submission.summary.latestRun?.matchesData).toBe(false);
    expect(stripped.project.runs[0]?.matchesData).toBe(false);
    const full = decodeSubmissionPackage((await createSubmissionFile(repos(student), project.id, submitter, true, deps)).bytes);
    expect(full.submission.summary.latestRun?.matchesData).toBe(true);
  });

  test('kèm dữ liệu gốc khi học sinh chọn', async () => {
    const { student, project } = await studentProject();
    await student.modelCards.save(project.id, card);
    await student.assignments.saveAnswers(project.id, ['a', 'b']);
    const { submission, project: bundle } = decodeSubmissionPackage((await createSubmissionFile(repos(student), project.id, { students: 'An', className: '' }, true, deps)).bytes);
    expect(submission.includesData).toBe(true);
    expect(bundle.images).toHaveLength(1);
  });
});
