import { useTranslation } from 'react-i18next';
import { useModeStore, type LearningMode } from './mode-store';

const MODES: readonly LearningMode[] = ['explore', 'expert'];

/** Công tắc chế độ học: Khám phá (THCS) / Chuyên sâu (THPT). */
export function ModeSwitch() {
  const { t } = useTranslation();
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);

  return (
    <fieldset className="flex rounded border border-[var(--color-rule)] bg-[var(--color-surface)] p-0.5 text-sm">
      <legend className="sr-only">{t('mode.label')}</legend>
      {MODES.map((m) => (
        <label
          key={m}
          title={t(`mode.${m}Hint`)}
          className={`cursor-pointer rounded px-2.5 py-1 font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--color-primary)] ${
            mode === m ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-muted)]'
          }`}
        >
          <input
            type="radio"
            name="learning-mode"
            value={m}
            checked={mode === m}
            onChange={() => setMode(m)}
            className="sr-only"
          />
          {t(`mode.${m}`)}
        </label>
      ))}
    </fieldset>
  );
}
