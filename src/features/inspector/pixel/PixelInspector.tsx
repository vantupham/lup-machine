import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MODEL_INPUT_SIZE, normalizePixelValue, readPixel, type RgbaImage } from '@/core/image/preprocess';
import type { StoredImage } from '@/storage/db';
import { useModeStore } from '@/ui/mode-store';
import { Dialog } from '@/ui/Dialog';
import { ExactBadge } from '@/ui/ExactBadge';
import { PixelGrid } from './PixelGrid';

const DISPLAY_SIZE = 336;
const TOTAL_VALUES = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3;
const CHANNELS = ['r', 'g', 'b'] as const;

type DecodeState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly image: RgbaImage }
  | { readonly status: 'error' };

interface PixelInspectorProps {
  readonly image: StoredImage;
  readonly title: string;
  readonly onClose: () => void;
  readonly decode: (image: StoredImage) => Promise<RgbaImage>;
}

export function PixelInspector({ image, title, onClose, decode }: PixelInspectorProps) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<DecodeState>({ status: 'loading' });
  const [pos, setPos] = useState({ x: MODEL_INPUT_SIZE / 2, y: MODEL_INPUT_SIZE / 2 });

  useEffect(() => {
    let isActive = true;
    decode(image).then(
      (decoded) => isActive && setState({ status: 'ready', image: decoded }),
      () => isActive && setState({ status: 'error' }),
    );
    return () => {
      isActive = false;
    };
  }, [image, decode]);

  const pipeline = t('project.inspector.pipeline', { returnObjects: true }) as string[];

  return (
    <Dialog title={t('project.inspector.title')} subtitle={title} onClose={onClose} closeLabel={t('project.inspector.close')}>
      <ol className="mb-5 flex flex-wrap items-center gap-1 text-xs">
        {pipeline.map((step, i) => (
          <li key={step} className="flex items-center gap-1">
            <span className="rounded border border-rule px-2 py-0.5">{step}</span>
            {i < pipeline.length - 1 && <span aria-hidden="true">→</span>}
          </li>
        ))}
        <li className="ml-auto">
          <ExactBadge label={t('project.inspector.exact')} hint={t('project.inspector.exactHint')} />
        </li>
      </ol>

      {state.status === 'loading' && <p>{t('project.inspector.loading')}</p>}
      {state.status === 'error' && <p role="alert">{t('project.inspector.error')}</p>}
      {state.status === 'ready' && (
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <PixelCanvas image={state.image} pos={pos} onSelect={setPos} label={t('project.inspector.imageLabel')} />
          <div className="space-y-4">
            <PixelDetails image={state.image} x={pos.x} y={pos.y} />
            <PixelGrid image={state.image} x={pos.x} y={pos.y} />
            <p className="text-sm text-muted">
              {t('project.inspector.total', { count: TOTAL_VALUES.toLocaleString(i18n.language) })}
            </p>
          </div>
        </div>
      )}

      <details className="mt-6 rounded border border-rule p-3 text-sm">
        <summary className="cursor-pointer font-medium">ⓘ {t('project.inspector.howTitle')}</summary>
        <p className="mt-2 leading-relaxed text-muted">{t('project.inspector.howBody')}</p>
      </details>
    </Dialog>
  );
}

interface PixelCanvasProps {
  readonly image: RgbaImage;
  readonly pos: { x: number; y: number };
  readonly onSelect: (pos: { x: number; y: number }) => void;
  readonly label: string;
}

function clamp(v: number): number {
  return Math.min(MODEL_INPUT_SIZE - 1, Math.max(0, v));
}

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function PixelCanvas({ image, pos, onSelect, label }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return; // môi trường không có canvas (ví dụ kiểm thử)
    ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  }, [image]);

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const scale = MODEL_INPUT_SIZE / rect.width;
    onSelect({ x: clamp(Math.floor((e.clientX - rect.left) * scale)), y: clamp(Math.floor((e.clientY - rect.top) * scale)) });
  };

  const handleKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const delta = ARROW_DELTAS[e.key];
    if (!delta) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    onSelect({ x: clamp(pos.x + delta[0] * step), y: clamp(pos.y + delta[1] * step) });
  };

  const cell = DISPLAY_SIZE / MODEL_INPUT_SIZE;
  return (
    <div className="relative h-fit w-fit">
      <canvas
        ref={canvasRef}
        width={MODEL_INPUT_SIZE}
        height={MODEL_INPUT_SIZE}
        tabIndex={0}
        role="img"
        aria-label={label}
        onClick={handleClick}
        onKeyDown={handleKey}
        className="block cursor-crosshair rounded-sm border border-rule [image-rendering:pixelated]"
        style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute border-2 border-highlight shadow-[0_0_0_1px_#000]"
        style={{ left: pos.x * cell - 3, top: pos.y * cell - 3, width: cell + 6, height: cell + 6 }}
      />
    </div>
  );
}

interface PixelDetailsProps {
  readonly image: RgbaImage;
  readonly x: number;
  readonly y: number;
}

function PixelDetails({ image, x, y }: PixelDetailsProps) {
  const { t, i18n } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const pixel = readPixel(image, x, y);
  const fmt = (v: number) => v.toLocaleString(i18n.language, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div>
      <h3 className="mb-2 font-semibold">{t('project.inspector.pixel', { x, y })}</h3>
      <table className="w-full text-sm">
        <tbody>
          {CHANNELS.map((c) => (
            <tr key={c} className="border-b border-rule">
              <th scope="row" className="py-1 text-left font-normal">
                {t(`project.inspector.channels.${c}`)}
              </th>
              <td className="py-1 text-right font-mono" data-testid={`pixel-${c}`}>
                {pixel[c]}
              </td>
              {mode === 'expert' && (
                <td className="py-1 pl-4 text-right font-mono text-accent">
                  → {fmt(normalizePixelValue(pixel[c]))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {mode === 'expert' && (
        <p className="mt-1 text-xs text-muted">
          {t('project.inspector.normalized')}: <code>{t('project.inspector.formula')}</code>
        </p>
      )}
    </div>
  );
}
