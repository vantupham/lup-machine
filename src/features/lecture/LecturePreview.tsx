import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from '@/ui/icons';
import type { AspectRatio, LectureScript } from './lecture-script';
import type { LectureTimeline } from './script-timeline';
import { frameLayout } from './render/frame-layout';
import { renderFrame, sceneAt } from './render/render-frame';

interface LecturePreviewProps {
  readonly script: LectureScript;
  readonly timeline: LectureTimeline;
  readonly aspect: AspectRatio;
  readonly burnSubtitles: boolean;
  readonly thumbs: ReadonlyMap<number, readonly CanvasImageSource[]>;
  /** Trạng thái tải ảnh thu nhỏ (ghi lên canvas để kiểm thử chờ được). */
  readonly thumbsPhase: 'loading' | 'ready' | 'error';
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Xem trước video ngay trên canvas: cùng hàm vẽ với lúc xuất tệp, nên xem sao xuất vậy. */
export function LecturePreview({ script, timeline, aspect, burnSubtitles, thumbs, thumbsPhase }: LecturePreviewProps) {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const layout = useMemo(() => frameLayout(aspect), [aspect]);
  const shownTime = Math.min(time, timeline.duration);
  const isAtEnd = shownTime >= timeline.duration;
  /** Chạy tới cuối video thì coi như đã dừng (suy ra, không cần đặt lại state). */
  const isRunning = isPlaying && !isAtEnd;
  const durationRef = useRef(timeline.duration);
  useEffect(() => {
    durationRef.current = timeline.duration;
  }, [timeline.duration]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    renderFrame(ctx, { script, timeline, time: shownTime, burnSubtitles }, { t, language: i18n.language, layout, thumbs });
  }, [script, timeline, shownTime, burnSubtitles, t, i18n.language, layout, thumbs]);

  useEffect(() => {
    if (!isRunning) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((prev) => {
        const next = Math.min(prev + dt, durationRef.current);
        // Hết video: dừng hẳn, để đổi khổ hay mức chi tiết (video dài ra) không tự phát tiếp.
        if (next >= durationRef.current) queueMicrotask(() => setIsPlaying(false));
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRunning, timeline.duration]);

  const togglePlay = () => {
    if (isRunning) {
      setIsPlaying(false);
      return;
    }
    if (isAtEnd) setTime(0);
    setIsPlaying(true);
  };

  const scene = script.scenes[sceneAt(timeline, shownTime).index];
  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={layout.size.width}
        height={layout.size.height}
        role="img"
        aria-label={t('lecture.panel.preview', { scene: scene?.title ?? '' })}
        data-aspect={aspect}
        data-thumbs={thumbsPhase}
        className={`mx-auto block rounded border border-rule bg-paper ${aspect === '16:9' ? 'w-full' : 'h-[60vh] max-w-full'}`}
      />
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={togglePlay}>
          {isRunning ? <Pause /> : <Play />} {t(isRunning ? 'lecture.panel.pause' : 'lecture.panel.play')}
        </button>
        <input
          type="range"
          className="flex-1"
          min={0}
          max={timeline.duration}
          step={0.1}
          value={shownTime}
          aria-label={t('lecture.panel.seek')}
          onChange={(e) => {
            setIsPlaying(false);
            setTime(Number(e.target.value));
          }}
        />
        <span className="font-mono text-sm tabular-nums">{t('lecture.panel.time', { current: clock(shownTime), total: clock(timeline.duration) })}</span>
      </div>
    </div>
  );
}
