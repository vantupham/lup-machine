import { useTranslation } from 'react-i18next';
import type { AudioClipRecord, ClassRecord } from '@/storage/db';
import { MAX_CLIPS_PER_CLASS } from '@/storage/repositories/audio-repository';
import { InlineClassName } from '@/features/studio/quick/InlineClassName';
import { Mic, Plus, Upload } from '@/ui/icons';
import { LiveSpectrum } from '../AudioDataSection';
import type { AudioData } from '../useAudioData';

interface AudioQuickClassesProps {
  readonly classes: readonly ClassRecord[];
  readonly clips: readonly AudioClipRecord[];
  readonly actions: AudioData;
}

/** Cột 1: mỗi nhóm một dòng gọn: đổi tên, thu 1 giây hoặc tải tệp; chưa có nhóm thì dùng âm thanh mẫu. */
export function AudioQuickClasses({ classes, clips, actions }: AudioQuickClassesProps) {
  const { t } = useTranslation();
  const { busy, isSupported, recordingClass } = actions;

  return (
    <div className="space-y-3">
      {!isSupported && <p className="text-sm text-warning">{t('audio.data.unsupported')}</p>}
      {classes.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted">{t('audio.data.empty')}</p>
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={() => void actions.loadSamples()}>
            {t('audio.data.loadSamples')}
          </button>
        </div>
      )}
      {classes.map((cls, i) => {
        const count = clips.filter((c) => c.classId === cls.id).length;
        const isRecording = recordingClass?.id === cls.id;
        const isBlocked = busy || !isSupported || count >= MAX_CLIPS_PER_CLASS;
        return (
          <div key={cls.id} role="group" aria-label={cls.name} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <InlineClassName name={cls.name} markerIndex={i} onRename={(name) => actions.rename(cls.id, name)} />
              <span className="shrink-0 font-mono text-xs text-muted">{t('audio.data.clipCount', { n: count })}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost px-2.5 py-1 text-sm"
                disabled={isBlocked}
                onClick={() => void actions.record(cls.id)}
                aria-label={t('audio.quick.record', { name: cls.name })}
              >
                <Mic /> {isRecording ? t('audio.data.recording') : t('audio.quick.recordShort')}
              </button>
              <label
                className={`btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${isBlocked ? 'pointer-events-none opacity-50' : ''}`}
              >
                <Upload /> {t('audio.quick.uploadShort')}
                <input
                  type="file"
                  multiple
                  accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
                  aria-label={t('audio.quick.upload', { name: cls.name })}
                  className="sr-only"
                  disabled={isBlocked}
                  onChange={(e) => {
                    // Chép danh sách tệp TRƯỚC khi xóa giá trị ô chọn: FileList sẽ rỗng sau đó.
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length > 0) void actions.upload(cls.id, files);
                  }}
                />
              </label>
            </div>
            {isRecording && recordingClass && (
              <div className="mt-2">
                <LiveSpectrum analyser={recordingClass.analyser} />
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn btn-ghost w-full justify-center border-dashed text-sm" disabled={busy} onClick={() => void actions.addClass()}>
        <Plus /> {t('audio.data.addClass')}
      </button>
      {actions.error && <p role="alert" className="text-sm text-danger">{actions.error}</p>}
    </div>
  );
}
