import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubmissionRepository } from '@/storage/repository-context';
import type { AssignmentSummary, StoredSubmission } from '@/storage/repositories/submission-repository';
import { rubricTotal } from '@/storage/schemas/assignment';
import { fileSlug } from '@/core/file-name';
import { floorPercent } from '@/core/percent';
import { downloadBytes } from '@/ui/download';
import { getErrorMessage } from '@/ui/error-message';
import { classStats, gradeSheet, type ImportResult } from './grading';
import { ImportSubmissions } from './ImportSubmissions';
import { SubmissionDetail } from './SubmissionDetail';
import { SubmissionsTable } from './SubmissionsTable';
import { formatScore } from './GradeForm';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Chấm bài: nhận bài nộp, bảng tổng hợp cả lớp, chấm từng bài theo rubric, xuất bảng điểm. */
export function GradingPanel() {
  const { t, i18n } = useTranslation();
  const repo = useSubmissionRepository();
  const [assignments, setAssignments] = useState<readonly AssignmentSummary[]>([]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  // Danh sách gắn với id bài tập: khi đổi bài tập, không bao giờ dùng nhầm bài nộp của bài cũ (bảng, xuất Excel).
  const [loaded, setLoaded] = useState<{ readonly assignmentId: string; readonly list: readonly StoredSubmission[] } | null>(null);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = assignments.find((a) => a.assignment.id === chosenId) ?? assignments[0] ?? null;
  const currentId = current?.assignment.id ?? null;

  const submissions = loaded && loaded.assignmentId === currentId ? loaded.list : [];

  /** Đọc lại danh sách bài tập và bài nộp (sau khi nhập / xóa). */
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const fail = useCallback(
    (err: unknown) => {
      console.error('Lỗi khi đọc / ghi bài nộp', err);
      setError(t('grading.loadError', { message: getErrorMessage(err) }));
    },
    [t],
  );

  useEffect(() => {
    let isActive = true;
    repo.listAssignments().then((list) => isActive && setAssignments(list), fail);
    return () => {
      isActive = false;
    };
  }, [repo, version, fail]);

  useEffect(() => {
    if (!currentId) return undefined;
    let isActive = true;
    repo.listByAssignment(currentId).then((list) => isActive && setLoaded({ assignmentId: currentId, list }), fail);
    return () => {
      isActive = false;
    };
  }, [repo, currentId, version, fail]);

  const handleImported = async (results: readonly ImportResult[]) => {
    if (results.some((r) => r.outcome !== 'error')) reload();
  };

  const handleSaved = (updated: StoredSubmission) =>
    setLoaded((current) => current && { ...current, list: current.list.map((s) => (s.id === updated.id ? updated : s)) });

  const handleDelete = async (s: StoredSubmission) => {
    if (!window.confirm(t('grading.detail.confirmDelete', { students: s.submission.submitter.students }))) return;
    try {
      await repo.delete(s.id);
      setSelectedId(null);
      reload();
    } catch (err: unknown) {
      fail(err);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!current || !window.confirm(t('grading.confirmDeleteAssignment', { count: current.count, title: current.assignment.title }))) return;
    try {
      await repo.deleteAssignment(current.assignment.id);
      setSelectedId(null);
      setChosenId(null);
      reload();
    } catch (err: unknown) {
      fail(err);
    }
  };

  const handleExport = async () => {
    if (!current) return;
    setError(null);
    try {
      const { writeXlsx } = await import('@/core/export/xlsx');
      const labels = {
        index: t('grading.sheet.index'),
        students: t('grading.sheet.students'),
        className: t('grading.sheet.className'),
        submittedAt: t('grading.sheet.submittedAt'),
        includesData: t('grading.sheet.includesData'),
        accuracy: t('grading.sheet.accuracy'),
        total: t('grading.sheet.total'),
        comment: t('grading.sheet.comment'),
        yes: t('grading.sheet.yes'),
        no: t('grading.sheet.no'),
        formatDate: (iso: string) => new Date(iso).toLocaleString(i18n.language),
      };
      const bytes = writeXlsx(gradeSheet(current.assignment, submissions, labels));
      downloadBytes(`${fileSlug(current.assignment.title)}-bang-diem.xlsx`, bytes, XLSX_MIME);
    } catch (err: unknown) {
      setError(t('grading.exportError', { message: getErrorMessage(err) }));
    }
  };

  const selected = submissions.find((s) => s.id === selectedId) ?? null;
  const stats = classStats(submissions);

  return (
    <div className="space-y-6">
      <ImportSubmissions onImported={handleImported} />
      {error && <p role="alert" className="rounded border border-danger p-3 text-sm text-danger">{error}</p>}
      {!current && <p className="rounded border border-dashed border-rule p-6 text-muted">{t('grading.empty')}</p>}
      {current && (
        <section aria-labelledby="class-title" className="lab-card space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="mr-auto">
              <label htmlFor="grading-assignment" className="mb-1 block text-sm font-medium">{t('grading.assignmentLabel')}</label>
              <select
                id="grading-assignment"
                value={current.assignment.id}
                onChange={(e) => {
                  setChosenId(e.target.value);
                  setSelectedId(null);
                }}
                className="rounded border border-rule bg-paper px-3 py-2"
              >
                {assignments.map((a) => (
                  <option key={a.assignment.id} value={a.assignment.id}>{t('grading.assignmentOption', { title: a.assignment.title, count: a.count })}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => void handleExport()} className="btn btn-primary text-sm">{t('grading.export')}</button>
            <button type="button" onClick={() => void handleDeleteAssignment()} className="btn btn-ghost text-sm">{t('grading.deleteAssignment')}</button>
          </div>
          <h2 id="class-title" className="text-xl font-semibold">{current.assignment.title}</h2>
          <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="class-stats">
            <span>{t('grading.statsGraded', { graded: stats.graded, count: stats.count })}</span>
            {stats.averageTotal !== null && <span>{t('grading.statsAverage', { value: formatScore(stats.averageTotal, i18n.language), max: rubricTotal(current.assignment.rubric) })}</span>}
            {stats.averageAccuracy !== null && <span>{t('grading.statsAccuracy', { value: floorPercent(stats.averageAccuracy) })}</span>}
          </p>
          <p className="text-xs text-muted">{t('grading.selfReported')}</p>
          <SubmissionsTable assignment={current.assignment} submissions={submissions} selectedId={selectedId} onSelect={setSelectedId} />
        </section>
      )}
      {selected && <SubmissionDetail key={selected.id} submission={selected} onSaved={handleSaved} onDelete={handleDelete} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
