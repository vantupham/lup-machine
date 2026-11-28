import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toSrt, toVtt } from '@/core/lecture/subtitles';
import { fileSlug } from '@/core/file-name';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import { Dialog } from '@/ui/Dialog';
import { downloadText } from '@/ui/download';
import { Download } from '@/ui/icons';
import type { AspectRatio, LectureLevel, LectureScript } from './lecture-script';
import { LecturePreview } from './LecturePreview';
import { buildTimeline } from './script-timeline';
import { useImageLecture } from './useImageLecture';
import { ExportControls } from './export/ExportControls';
import { frameLayout } from './render/frame-layout';

interface LecturePanelProps {
  readonly projectId: string;
  readonly projectName: string;
  readonly classes: readonly ClassRecord[];
  readonly samples: readonly SampleRecord[];
  readonly onClose: () => void;
}

interface ChoiceProps<V extends string> {
  readonly legend: string;
  readonly name: string;
  readonly value: V;
  readonly options: readonly { readonly value: V; readonly label: string }[];
  readonly onChange: (value: V) => void;
}

function Choice<V extends string>({ legend, name, value, options, onChange }: ChoiceProps<V>) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SceneList({ script }: { readonly script: LectureScript }) {
  const { t } = useTranslation();
  return (
    <details className="rounded border border-rule bg-surface p-3">
      <summary className="cursor-pointer font-semibold">{t('lecture.panel.scenes')}</summary>
      <ol className="mt-3 space-y-3">
        {script.scenes.map((scene) => (
          <li key={scene.id}>
            <h3 className="font-semibold">{scene.title}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {scene.lines.map((line, i) => (
                <li key={i}>{line.display}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Hộp thoại "Video bài giảng" của dự án ảnh: chọn khổ, mức chi tiết, xem trước, tải phụ đề. */
export function LecturePanel({ projectId, projectName, classes, samples, onClose }: LecturePanelProps) {
  const { t, i18n } = useTranslation();
  const [aspect, setAspect] = useState<AspectRatio>('16:9');
  const [level, setLevel] = useState<LectureLevel>('explore');
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [includeStudentWriting, setIncludeStudentWriting] = useState(false);
  const lecture = useImageLecture(projectId, projectName, classes, samples, { level, includeStudentWriting });
  const timeline = useMemo(() => (lecture.script ? buildTimeline(lecture.script, aspect) : null), [lecture.script, aspect]);
  const env = useMemo(() => ({ t, language: i18n.language, layout: frameLayout(aspect), thumbs: lecture.thumbs }), [t, i18n.language, aspect, lecture.thumbs]);
  /** Chờ ảnh thu nhỏ và soi kỹ xong để video xuất ra có đủ cảnh, đủ ảnh. */
  const isReadyToExport = lecture.thumbsPhase !== 'loading' && lecture.deepStatus.phase !== 'running';

  const download = (kind: 'srt' | 'vtt') => {
    if (!timeline) return;
    const name = `${fileSlug(projectName)}-bai-giang-${aspect === '16:9' ? '16x9' : '9x16'}.${kind}`;
    downloadText(name, kind === 'srt' ? toSrt(timeline.cues) : toVtt(timeline.cues), kind === 'srt' ? 'application/x-subrip' : 'text/vtt');
  };

  return (
    <Dialog title={t('lecture.panel.title')} subtitle={t('lecture.panel.lead')} closeLabel={t('lecture.panel.close')} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Choice
            legend={t('lecture.panel.aspect')}
            name="lecture-aspect"
            value={aspect}
            onChange={setAspect}
            options={[
              { value: '16:9', label: t('lecture.panel.landscape') },
              { value: '9:16', label: t('lecture.panel.portrait') },
            ]}
          />
          <Choice
            legend={t('lecture.panel.level')}
            name="lecture-level"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'explore', label: t('lecture.panel.explore') },
              { value: 'expert', label: t('lecture.panel.expert') },
            ]}
          />
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={burnSubtitles} onChange={(e) => setBurnSubtitles(e.target.checked)} />
              {t('lecture.panel.burn')}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includeStudentWriting} onChange={(e) => setIncludeStudentWriting(e.target.checked)} />
              {t('lecture.panel.studentWriting')}
            </label>
          </div>
        </div>

        <div className="space-y-1 text-sm" aria-live="polite">
          {lecture.deepStatus.phase === 'running' && <p>{t('lecture.panel.checking', { done: lecture.deepStatus.done, total: lecture.deepStatus.total })}</p>}
          {lecture.deepError && <p className="text-danger">{t('lecture.panel.checkError', { message: lecture.deepError })}</p>}
          {!lecture.hasEvaluation && <p className="text-muted">{t('lecture.panel.noEvaluation')}</p>}
          {lecture.thumbsFailed && <p className="text-muted">{t('lecture.panel.thumbsError')}</p>}
        </div>

        {lecture.script && timeline && (
          <>
            <LecturePreview script={lecture.script} timeline={timeline} aspect={aspect} burnSubtitles={burnSubtitles} thumbs={lecture.thumbs} thumbsPhase={lecture.thumbsPhase} />
            <ExportControls job={{ projectName, aspect, script: lecture.script, timeline, burnSubtitles, env }} isReady={isReadyToExport} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => download('srt')}>
                <Download /> {t('lecture.panel.downloadSrt')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => download('vtt')}>
                <Download /> {t('lecture.panel.downloadVtt')}
              </button>
            </div>
            <p className="text-sm text-muted">{t('lecture.panel.privacyNote')}</p>
            <SceneList script={lecture.script} />
          </>
        )}
      </div>
    </Dialog>
  );
}
