import type { TFunction } from 'i18next';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Trash2 } from '@/ui/icons';
import type { LectureScene, LectureScript } from '../lecture-script';
import { sceneText, type SceneVoice } from './useLectureVoices';
import type { RecorderState } from './useVoiceRecorder';

interface VoiceScenesProps {
  readonly script: LectureScript;
  readonly voices: ReadonlyMap<string, SceneVoice>;
  readonly recorder: RecorderState;
  readonly onRecord: (scene: LectureScene) => void;
  readonly onStop: () => void;
  readonly onRemove: (scene: LectureScene) => void;
}

/** Nghe lại bản thu: tạo URL tạm từ dữ liệu trên máy, thu hồi khi không dùng nữa. */
function VoiceClip({ voice, label }: { readonly voice: SceneVoice; readonly label: string }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([voice.voice.audio], { type: voice.voice.mime })), [voice]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <audio controls src={url} aria-label={label} className="h-8 max-w-full" />;
}

function SceneRow({ scene, voice, recorder, onRecord, onStop, onRemove }: { readonly scene: LectureScene; readonly voice: SceneVoice | undefined } & Omit<VoiceScenesProps, 'script' | 'voices'>) {
  const { t, i18n } = useTranslation();
  const isThis = recorder.phase !== 'idle' && recorder.sceneId === scene.id;
  const isRecording = isThis && recorder.phase === 'recording';
  const isBusy = recorder.phase === 'starting' || recorder.phase === 'recording' || recorder.phase === 'saving';
  const seconds = (v: number) => v.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const isChanged = voice !== undefined && voice.voice.text !== sceneText(scene);

  return (
    <li className={`space-y-2 rounded border p-3 ${isRecording ? 'border-danger bg-surface' : 'border-rule'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold">{scene.title}</h3>
        {voice && !isRecording && <span className="text-sm text-muted">{t('lecture.voice.recorded', { seconds: seconds(voice.voice.duration) })}</span>}
        {isRecording ? (
          <button type="button" className="btn btn-primary" onClick={onStop}>
            <Square /> {t('lecture.voice.stop', { seconds: Math.floor(recorder.elapsed) })}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={isBusy} onClick={() => onRecord(scene)} aria-label={t('lecture.voice.recordAria', { scene: scene.title })}>
            <Mic /> {t(voice ? 'lecture.voice.rerecord' : 'lecture.voice.record')}
          </button>
        )}
        {voice && !isRecording && (
          <button type="button" className="btn btn-ghost px-2" disabled={isBusy} onClick={() => onRemove(scene)} aria-label={t('lecture.voice.removeAria', { scene: scene.title })}>
            <Trash2 />
          </button>
        )}
      </div>
      {/* Đang thu: lời của cảnh hiện chữ lớn như máy nhắc chữ. */}
      <ul className={isRecording ? 'space-y-2 text-2xl leading-snug' : 'list-disc space-y-1 pl-5 text-sm'}>
        {scene.lines.map((line, i) => (
          <li key={i}>{line.display}</li>
        ))}
      </ul>
      {voice && !isRecording && <VoiceClip voice={voice} label={t('lecture.voice.listen', { scene: scene.title })} />}
      {isChanged && <p className="text-sm text-warning">{t('lecture.voice.changed')}</p>}
      {isThis && recorder.phase === 'saving' && <p className="text-sm text-muted">{t('lecture.voice.saving')}</p>}
      {isThis && recorder.phase === 'error' && (
        <p role="alert" className="text-sm text-danger">
          {recorder.kind === 'failed' ? t('lecture.voice.failed', { message: recorder.message }) : t(`lecture.voice.${recorder.kind}`)}
        </p>
      )}
    </li>
  );
}

/** Câu báo cho trình đọc màn hình khi bắt đầu thu / đang lưu (không đọc từng giây). */
function announcement(t: TFunction, script: LectureScript, recorder: RecorderState): string {
  if (recorder.phase !== 'recording' && recorder.phase !== 'saving') return '';
  const title = script.scenes.find((s) => s.id === recorder.sceneId)?.title ?? '';
  return t(recorder.phase === 'recording' ? 'lecture.voice.recordingNow' : 'lecture.voice.saving', { scene: title });
}

/** Lời giảng từng cảnh kèm nút thu giọng; giọng thu chỉ lưu trên máy này. */
export function VoiceScenes(props: VoiceScenesProps) {
  const { t } = useTranslation();
  const done = props.script.scenes.filter((s) => props.voices.has(s.id)).length;
  return (
    <section aria-labelledby="lecture-voice-title" className="space-y-3">
      <div>
        <h3 id="lecture-voice-title" className="text-lg font-semibold">
          {t('lecture.voice.title')}
        </h3>
        <p className="text-sm text-muted">{t('lecture.voice.lead')}</p>
        <p className="text-sm text-muted">
          {t('lecture.voice.count', { done, total: props.script.scenes.length })} {t('lecture.voice.localNote')}
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {announcement(t, props.script, props.recorder)}
        </p>
      </div>
      <ol className="space-y-3">
        {props.script.scenes.map((scene) => (
          <SceneRow key={scene.id} scene={scene} voice={props.voices.get(scene.id)} recorder={props.recorder} onRecord={props.onRecord} onStop={props.onStop} onRemove={props.onRemove} />
        ))}
      </ol>
    </section>
  );
}
