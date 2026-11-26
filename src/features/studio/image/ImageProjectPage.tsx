import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { stratifiedSplit } from '@/core/data/split';
import type { ClassRecord, SampleRecord, Split, StoredImage } from '@/storage/db';
import { MAX_SAMPLES_PER_CLASS, type SplitCounts } from '@/storage/repositories/dataset-repository';
import { useDatasetRepository, useExperimentRepository } from '@/storage/repository-context';
import { getErrorMessage } from '@/ui/error-message';
import { PixelInspector } from '@/features/inspector/pixel/PixelInspector';
import { ClassPanel } from './ClassPanel';
import { QualityPanel } from './QualityPanel';
import { StepBar, type StepTargets } from '@/features/studio/StepBar';
import { ProjectTitle } from '@/features/studio/ProjectTitle';
import { WebcamCapture } from './WebcamCapture';
import { useProjectData } from './useProjectData';
import { useImageUpload } from './useImageUpload';
import { useFaceBlurSetting } from './face-blur-setting';
import { faceBlurSummary } from './face-blur-message';
import { decodeStoredImage, videoFrameToStoredImage } from './image-codec.browser';
import { ModelLab } from './lab/ModelLab';
import { ImageLabProvider } from './lab/ImageLabContext';
import { QuickWorkspace } from './quick/QuickWorkspace';
import { useModeStore, useModeSwitch } from '@/ui/mode-store';
import { useStepDetailsStore } from '@/features/studio/step-details';
import { ChevronDown, ChevronUp, Plus } from '@/ui/icons';
import { NotebookPrintLink } from '@/features/notebook/NotebookPrintLink';
import { ModelCardLink } from '@/features/model-card/ModelCardLink';
import { AssignmentBanner } from '@/features/classroom/AssignmentBanner';
import { BackLink } from '@/ui/BackLink';
import { StepNumber } from '@/ui/StepNumber';
import { nextClassName } from '@/features/studio/next-class-name';
import { NotebookProvider } from '@/features/notebook/NotebookContext';
import type { ImproveActions } from './lab/improve-actions';
import { StepNotebook } from '@/features/notebook/StepNotebook';

/** Lớp phân biệt bằng cả ký hiệu, không chỉ màu (thân thiện người mù màu). */
export const SPLIT_SEED = 42;

/** Id tiêu đề các phần của Studio ảnh, theo thứ tự 6 bước. */
const IMAGE_STEP_TARGETS: StepTargets = {
  data: 'data-title',
  check: 'quality-title',
  represent: 'represent-title',
  train: 'train-title',
  evaluate: 'evaluate-title',
  use: 'use-title',
};
const TEST_RATIO = 0.2;

type Message = { readonly kind: 'info' | 'error'; readonly text: string } | null;

export function ImageProjectPage() {
  const { projectId = '' } = useParams();
  const { t } = useTranslation();
  const { data, reload } = useProjectData(projectId);

  if (data.status === 'loading') return <p>…</p>;
  if (data.status === 'not-found' || data.status === 'error') {
    return (
      <div className="space-y-4">
        <BackLink to="/studio">{t('project.back')}</BackLink>
        <p role="alert">{t(data.status === 'error' ? 'project.loadError' : 'project.notFound')}</p>
      </div>
    );
  }
  return <ProjectWorkspace projectName={data.project.name} projectId={projectId} classes={data.classes} samples={data.samples} reload={reload} />;
}

interface WorkspaceProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly classes: ClassRecord[];
  readonly samples: SampleRecord[];
  readonly reload: () => Promise<void>;
}

function ProjectWorkspace({ projectId, projectName, classes, samples, reload }: WorkspaceProps) {
  const { t } = useTranslation();
  const dataset = useDatasetRepository();
  const experimentRepo = useExperimentRepository();
  const [message, setMessage] = useState<Message>(null);
  const [inspecting, setInspecting] = useState<SampleRecord | null>(null);
  const [webcam, setWebcam] = useState<{ cls: ClassRecord; split: Split } | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    try {
      const info = await action();
      setMessage(info ? { kind: 'info', text: info } : null);
    } catch (error: unknown) {
      setMessage({ kind: 'error', text: t('project.data.actionError', { message: getErrorMessage(error) }) });
    } finally {
      await reload();
    }
  };

  const mode = useModeStore((s) => s.mode);
  useModeSwitch();
  const isDetailsOpen = useStepDetailsStore((s) => s.isOpen);
  const setDetailsOpen = useStepDetailsStore((s) => s.setOpen);
  /** Khám phá: các bước chi tiết thu gọn tới khi người xem mở (hoặc bấm một bước). Chuyên sâu: luôn mở. */
  const showDetails = mode === 'expert' || isDetailsOpen;
  const [blurFaces, setBlurFaces] = useFaceBlurSetting(projectId);
  const { upload, progress } = useImageUpload(projectId, (text, kind) => setMessage({ kind, text }), reload, blurFaces);

  const byClass = useMemo(() => {
    const map = new Map<string, SampleRecord[]>(classes.map((c) => [c.id, []]));
    for (const s of samples) map.get(s.classId)?.push(s);
    return map;
  }, [classes, samples]);

  const counts: SplitCounts = useMemo(() => {
    const result: SplitCounts = {};
    for (const [id, list] of byClass) {
      result[id] = { train: list.filter((s) => s.split === 'train').length, test: list.filter((s) => s.split === 'test').length };
    }
    return result;
  }, [byClass]);

  /** Bước Dữ liệu xong khi ít nhất 2 lớp có ảnh huấn luyện. */
  const dataReady = Object.values(counts).filter((c) => c.train > 0).length >= 2;

  const autoSplit = () =>
    run(async () => {
      const { train, test } = stratifiedSplit(
        samples.map((s) => ({ id: s.id, label: s.classId })),
        { testRatio: TEST_RATIO, seed: SPLIT_SEED },
      );
      await dataset.setSplits([
        ...train.map((s) => ({ id: s.id, split: 'train' as const })),
        ...test.map((s) => ({ id: s.id, split: 'test' as const })),
      ]);
      return t('project.data.autoSplitDone', { train: train.length, test: test.length });
    });

  const logActionError = (error: unknown) => {
    console.error('Thao tác ở khối làm nhanh lỗi', error);
    setMessage({ kind: 'error', text: t('project.data.actionError', { message: getErrorMessage(error) }) });
  };

  /** Đổi tên lớp (dùng chung cho khối làm nhanh và bước 1). Trả về false nếu lỗi để ô sửa vẫn mở. */
  const renameClass = async (cls: ClassRecord, name: string): Promise<boolean> => {
    try {
      await dataset.renameClass(cls.id, name);
      await reload();
      return true;
    } catch (error: unknown) {
      setMessage({ kind: 'error', text: t('project.data.actionError', { message: getErrorMessage(error) }) });
      return false;
    }
  };

  /** Thêm "Lớp n" (số tăng dần, không trùng tên đã có); đổi tên sau bằng nút bút chì. */
  const addNextClass = () =>
    run(async () => {
      await dataset.addClass(projectId, nextClassName(classes.map((c) => c.name), (n) => t('project.defaultClass', { n })));
      return null;
    });

  /** Số khuôn mặt đã làm mờ trong lần chụp webcam đang mở. */
  const webcamFaces = useRef(0);

  const saveWebcam = (images: StoredImage[]) => {
    const target = webcam;
    const faces = webcamFaces.current;
    setWebcam(null);
    if (!target || images.length === 0) return;
    void run(async () => {
      await dataset.addSamples(images.map((image) => ({ projectId, classId: target.cls.id, split: target.split, source: 'webcam' as const, image })));
      const added = t('project.upload.added', { count: images.length, name: target.cls.name, split: t(`project.class.${target.split}`) });
      return blurFaces ? `${added} ${faceBlurSummary(t, faces, images.length)}` : added;
    });
  };

  /**
   * Đổi tập Kiểm tra sau khi đã huấn luyện thì điểm Kiểm tra không còn so được với các lần trước
   * (chuyển sang Huấn luyện còn là cho máy "xem trước đề thi"): hỏi lại trước.
   */
  const acknowledgedLeaks = useRef(new Set<'leakMove' | 'leakDelete'>());
  const confirmTestChange = async (sample: SampleRecord, key: 'leakMove' | 'leakDelete'): Promise<boolean> => {
    if (sample.split !== 'test' || acknowledgedLeaks.current.has(key)) return true;
    const runs = await experimentRepo.listRuns(projectId);
    if (runs.length === 0) return true;
    // Đã đồng ý một lần thì không hỏi lại trong lúc dự án đang mở (bài 3 chuyển 6 ảnh liền nhau).
    const isConfirmed = window.confirm(t(`project.improve.${key}`));
    if (isConfirmed) acknowledgedLeaks.current.add(key);
    return isConfirmed;
  };

  const moveSample = (sample: SampleRecord) =>
    void (async () => {
      if (!(await confirmTestChange(sample, 'leakMove'))) return;
      await run(async () => {
        await dataset.setSplits([{ id: sample.id, split: sample.split === 'train' ? 'test' : 'train' }]);
        return null;
      });
    })().catch(logActionError);

  const deleteSample = (sample: SampleRecord, ask = false) =>
    void (async () => {
      const isConfirmed = sample.split === 'test' ? await confirmTestChange(sample, 'leakDelete') : !ask || window.confirm(t('project.improve.confirmDelete'));
      if (!isConfirmed) return;
      await run(async () => {
        await dataset.deleteSample(sample.id);
        return null;
      });
    })().catch(logActionError);

  const improve: ImproveActions = {
    capture: (cls) => {
      webcamFaces.current = 0;
      setWebcam({ cls, split: 'train' });
    },
    upload: (cls, files) => void upload(cls, files, 'train', byClass.get(cls.id)?.length ?? 0).catch(logActionError),
    deleteSample: (sample) => deleteSample(sample, true),
  };

  const inspectingClass = inspecting ? classes.find((c) => c.id === inspecting.classId) : undefined;

  return (
    <ImageLabProvider projectId={projectId} classes={classes} samples={samples}>
    <NotebookProvider projectId={projectId} projectType="image">
    <div className="space-y-8">
      <header className="space-y-4">
        <BackLink to="/studio">{t('project.back')}</BackLink>
        <ProjectTitle projectId={projectId} name={projectName} onRenamed={() => void reload()} />
        <AssignmentBanner projectId={projectId} />
        <div className="flex flex-wrap gap-2">
          <ModelCardLink projectId={projectId} />
          <NotebookPrintLink projectId={projectId} />
        </div>
      </header>

      <StepBar targets={IMAGE_STEP_TARGETS} />

      {(message || progress) && (
        <p
          role={message?.kind === 'error' ? 'alert' : 'status'}
          className={`rounded border p-3 text-sm ${message?.kind === 'error' ? 'border-danger text-danger' : 'border-rule bg-surface'}`}
        >
          {progress ? t('project.upload.processing', progress) : message?.text}
        </p>
      )}

      {mode === 'explore' && (
        <QuickWorkspace
          classes={classes}
          samples={samples}
          samplesByClass={byClass}
          onWebcam={(c) => {
            webcamFaces.current = 0;
            setWebcam({ cls: c, split: 'train' });
          }}
          onUpload={(c, files) => upload(c, [...files], 'train', byClass.get(c.id)?.length ?? 0).catch(logActionError)}
          onAddClass={() => addNextClass().catch(logActionError)}
          onRename={renameClass}
          isCapturing={webcam !== null}
        />
      )}

      {mode === 'explore' && (
        <button
          type="button"
          aria-expanded={showDetails}
          aria-controls="step-details"
          onClick={() => setDetailsOpen(!showDetails)}
          className="btn btn-ghost"
        >
          {showDetails ? <ChevronUp /> : <ChevronDown />}
          {t(showDetails ? 'project.details.hide' : 'project.details.show')}
        </button>
      )}

      <div id="step-details" data-step-details hidden={!showDetails} className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="data-title" data-step-done={dataReady ? 'true' : undefined} className="space-y-4">
          <div>
            <h2 id="data-title" className="flex items-center gap-3 text-2xl font-semibold"><StepNumber n={1} />{t('project.data.title')}</h2>
            <p className="max-w-2xl text-sm text-muted">{t('project.data.lead')}</p>
          </div>
          <div className="rounded border border-rule bg-surface p-3">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={blurFaces} onChange={(e) => setBlurFaces(e.target.checked)} aria-describedby="blur-faces-hint" />
              {t('project.faceBlur.label')}
            </label>
            <p id="blur-faces-hint" className="mt-1 pl-6 text-sm text-muted">{t('project.faceBlur.hint')}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <button type="button" className="btn btn-primary" onClick={() => void addNextClass()}>
              <Plus /> {t('project.data.addClass')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void autoSplit()} disabled={samples.length === 0} title={t('project.data.autoSplitHint', { seed: SPLIT_SEED })}>
              {t('project.data.autoSplit')}
            </button>
          </div>
          {classes.map((cls, i) => (
            <ClassPanel
              key={cls.id}
              cls={cls}
              markerIndex={i}
              samples={byClass.get(cls.id) ?? []}
              onUpload={(c, files, split) => void upload(c, files, split, byClass.get(c.id)?.length ?? 0)}
              onWebcam={(c, split) => {
                webcamFaces.current = 0;
                setWebcam({ cls: c, split });
              }}
              onRename={renameClass}
              onDelete={(c, count) => {
                if (window.confirm(t('project.class.confirmDelete', { name: c.name, count }))) {
                  void run(async () => { await dataset.deleteClass(c.id); return null; });
                }
              }}
              onInspect={setInspecting}
              onMove={moveSample}
              onDeleteSample={(s) => deleteSample(s)}
            />
          ))}
          <StepNotebook step="data" />
        </section>
        <QualityPanel classes={classes} counts={counts} />
      </div>

      <ModelLab projectName={projectName} classes={classes} samples={samples} improve={improve} />
      </div>

      {inspecting && (
        <PixelInspector
          image={inspecting.image}
          title={inspectingClass?.name ?? ''}
          onClose={() => setInspecting(null)}
          decode={decodeStoredImage}
          credit={inspecting.credit}
        />
      )}
      {webcam && (
        <WebcamCapture
          title={t('project.webcam.title', { name: webcam.cls.name })}
          remaining={MAX_SAMPLES_PER_CLASS - (byClass.get(webcam.cls.id)?.length ?? 0)}
          captureFrame={(video) => videoFrameToStoredImage(video, { blurFaces, onFaces: (n) => (webcamFaces.current += n) })}
          onDone={saveWebcam}
        />
      )}
    </div>
    </NotebookProvider>
    </ImageLabProvider>
  );
}
