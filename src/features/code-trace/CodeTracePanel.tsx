import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PythonProgram } from '@/core/trace/program';
import { formatShape, formatValue, type TraceValue } from '@/core/trace/trace-value';
import { ExactBadge } from '@/ui/ExactBadge';
import { Code, Pause, Play, RotateCcw, SkipForward, StepForward } from '@/ui/icons';
import { CodeView } from './CodeView';
import { TRACE_SPEEDS, useTracePlayer, type PlayerState, type TraceFactory } from './useTracePlayer';

interface CodeTracePanelProps {
  readonly program: PythonProgram;
  readonly helpers: PythonProgram;
  /** Tạo vết chạy với dữ liệu thật của bước; null khi chưa đủ dữ liệu để chạy. */
  readonly create: TraceFactory | null;
  /** Lời nhắc khi `create` là null (mặc định: huấn luyện trước). */
  readonly emptyHint?: string;
  /** Nhãn nút chạy đến dòng in tiếp theo (mặc định: "Đến hết epoch"). */
  readonly jumpLabel?: string;
}

/** Mỗi hàm tạo vết một số riêng: lần huấn luyện mới (hàm mới) thì phần phát lại bắt đầu lại từ đầu. */
const factoryIds = new WeakMap<TraceFactory, number>();
let nextFactoryId = 1;
function keyOf(create: TraceFactory): number {
  let id = factoryIds.get(create);
  if (id === undefined) {
    id = nextFactoryId++;
    factoryIds.set(create, id);
  }
  return id;
}

/**
 * Khung "Mã Python": chương trình Python tương ứng với bước này, chạy từng dòng với số liệu thật.
 * memo: bước Huấn luyện vẽ lại sau mỗi epoch, khung này không cần vẽ lại theo.
 * Nội dung (khoảng 100 dòng mã đã tô màu) chỉ dựng khi mở lần đầu, rồi giữ lại để không mất chỗ đang chạy.
 */
export const CodeTracePanel = memo(function CodeTracePanel({ program, helpers, create, emptyHint, jumpLabel }: CodeTracePanelProps) {
  const { t } = useTranslation();
  const [hasOpened, setHasOpened] = useState(false);
  return (
    <details className="rounded border border-rule p-3" data-testid="code-trace" data-program={program.fileName} onToggle={(e) => e.currentTarget.open && setHasOpened(true)}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold">
        <Code />
        <span>{t('codeTrace.title')}</span>
        <ExactBadge label={t('playground.exact')} hint={t('codeTrace.exactHint')} />
      </summary>
      {hasOpened && (
        <div className="mt-3 space-y-3">
          <p className="max-w-3xl text-sm text-muted">{t('codeTrace.lead')}</p>
          {create ? (
            <TraceBody key={keyOf(create)} program={program} create={create} jumpLabel={jumpLabel ?? t('codeTrace.toEpochEnd')} />
          ) : (
            <>
              <p className="text-sm text-warning">{emptyHint ?? t('codeTrace.needRun')}</p>
              <CodeView program={program} />
            </>
          )}
          <LazyDetails summary={t('codeTrace.helpers', { file: helpers.fileName })}>
            <p className="my-2 text-xs text-muted">{t('codeTrace.helpersNote')}</p>
            <CodeView program={helpers} />
          </LazyDetails>
        </div>
      )}
    </details>
  );
});

/** <details> chỉ dựng nội dung sau lần mở đầu tiên. */
function LazyDetails({ summary, children }: { readonly summary: string; readonly children: ReactNode }) {
  const [hasOpened, setHasOpened] = useState(false);
  return (
    <details className="text-sm" onToggle={(e) => e.currentTarget.open && setHasOpened(true)}>
      <summary className="cursor-pointer text-muted">{summary}</summary>
      {hasOpened && children}
    </details>
  );
}

interface TraceBodyProps {
  readonly program: PythonProgram;
  readonly create: TraceFactory;
  readonly jumpLabel: string;
}

function TraceBody({ program, create, jumpLabel }: TraceBodyProps) {
  const { t } = useTranslation();
  const player = useTracePlayer(create);
  const { state } = player;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="min-w-0 space-y-3">
        <CodeView program={program} activeLine={state.step?.line ?? null} />
        <Controls player={player} jumpLabel={jumpLabel} />
        <p className="font-mono text-sm" aria-live={player.isPlaying ? 'off' : 'polite'}>
          {state.isFinished
            ? t('codeTrace.finished')
            : state.step
              ? state.step.epoch > 0
              ? t('codeTrace.position', { epoch: state.step.epoch, line: state.step.line + 1 })
              : t('codeTrace.positionLine', { line: state.step.line + 1 })
              : t('codeTrace.start')}
        </p>
        <Console lines={state.output} />
      </div>
      <Variables state={state} />
    </div>
  );
}

function Controls({ player, jumpLabel }: { readonly player: ReturnType<typeof useTracePlayer>; readonly jumpLabel: string }) {
  const { t } = useTranslation();
  const { state } = player;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-ghost" onClick={player.reset} disabled={state.step === null}>
        <RotateCcw /> {t('codeTrace.reset')}
      </button>
      <button type="button" className="btn btn-ghost" onClick={player.stepOnce} disabled={player.isPlaying || state.isFinished}>
        <StepForward /> {t('codeTrace.step')}
      </button>
      {player.isPlaying ? (
        <button type="button" className="btn btn-primary" onClick={player.pause}><Pause /> {t('codeTrace.pause')}</button>
      ) : (
        <button type="button" className="btn btn-primary" onClick={player.play} disabled={state.isFinished}><Play /> {t('codeTrace.play')}</button>
      )}
      <button type="button" className="btn btn-ghost" onClick={player.runToOutput} disabled={player.isPlaying || state.isFinished}>
        <SkipForward /> {jumpLabel}
      </button>
      <fieldset className="flex items-center gap-1 text-sm">
        <legend className="sr-only">{t('codeTrace.speed')}</legend>
        <span aria-hidden="true" className="text-xs text-muted">{t('codeTrace.speed')}</span>
        {TRACE_SPEEDS.map((s) => (
          <label key={s} className={`cursor-pointer rounded border px-2 py-1 ${player.speed === s ? 'border-primary' : 'border-rule'}`}>
            <input type="radio" name="trace-speed" className="sr-only" checked={player.speed === s} onChange={() => player.setSpeed(s)} />
            {t(`codeTrace.speeds.${s}`)}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function Variables({ state }: { readonly state: PlayerState }) {
  const { t } = useTranslation();
  const changed = new Set(state.changed);
  return (
    <section aria-label={t('codeTrace.variables')} className="rounded border border-rule p-2 text-xs">
      <h4 className="mb-1 font-semibold">{t('codeTrace.variables')}</h4>
      {state.vars.length === 0 ? (
        <p className="text-muted">{t('codeTrace.noVariables')}</p>
      ) : (
        <dl className="space-y-0.5 font-mono">
          {state.vars.map(([name, value]) => (
            <div key={name} data-changed={changed.has(name) ? 'true' : undefined} className={`rounded px-1 ${changed.has(name) ? 'bg-highlight/40' : ''}`}>
              <dt className="inline font-semibold">{name}</dt>
              {value.kind === 'array' && <span className="ml-1 text-muted">{formatShape(value.shape)}</span>}
              {changed.has(name) && <span className="sr-only"> ({t('codeTrace.changed')})</span>}
              <dd className="ml-1 inline">{describe(name, value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** "X_train[0, :3]" hiện gọn thành "[0, :3] = …" vì tên biến đã đứng trước. */
function describe(name: string, value: TraceValue): string {
  const view = value.kind === 'array' && value.view.startsWith(name) ? value.view.slice(name.length) : '';
  return `${view}${view ? ' ' : ''}= ${formatValue(value)}`;
}

function Console({ lines }: { readonly lines: readonly string[] }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{t('codeTrace.console')}</p>
      <pre ref={ref} data-testid="code-trace-console" className="max-h-40 overflow-auto rounded border border-rule bg-paper p-2 font-mono text-xs">
        {lines.length === 0 ? <span className="text-muted">{t('codeTrace.consoleEmpty')}</span> : lines.join('\n')}
      </pre>
    </div>
  );
}
