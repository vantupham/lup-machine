import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import type { ProjectRecord } from '@/storage/db';
import { useRepositories } from '@/storage/repository-context';
import {
  EMPTY_MODEL_CARD,
  MODEL_CARD_AUTHORS_MAX_LENGTH,
  MODEL_CARD_TEXT_FIELDS,
  MODEL_CARD_TEXT_MAX_LENGTH,
  missingModelCardFields,
  pickModelCardFields,
  type ModelCardFields,
} from '@/storage/schemas/model-card';
import { getErrorMessage } from '@/ui/error-message';
import { FactsPanel } from './FactsPanel';
import { loadModelCardFacts, type ModelCardFacts } from './facts';
import { Check, Printer } from '@/ui/icons';
import { BackLink } from '@/ui/BackLink';

type LoadState =
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly project: ProjectRecord; readonly facts: ModelCardFacts; readonly saved: ModelCardFields; readonly updatedAt: string | null };

/** Kết quả tải gắn với id dự án: đổi dự án thì coi như đang tải lại, không hiện thẻ của dự án cũ. */
type Loaded = { readonly projectId: string; readonly state: LoadState } | null;

type SaveMessage = { readonly kind: 'saved' } | { readonly kind: 'error'; readonly message: string } | null;

/** Trang Thẻ mô hình của một dự án: #/studio/:projectId/the-mo-hinh. */
export function ModelCardPage() {
  const { t } = useTranslation();
  const { projectId = '' } = useParams();
  const repos = useRepositories();
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let isActive = true;
    const load = async (): Promise<LoadState> => {
      const project = await repos.projects.findById(projectId);
      if (!project) return { status: 'not-found' };
      const [facts, card] = await Promise.all([loadModelCardFacts(repos, project), repos.modelCards.get(projectId)]);
      return { status: 'ready', project, facts, saved: card ? pickModelCardFields(card) : EMPTY_MODEL_CARD, updatedAt: card?.updatedAt ?? null };
    };
    load().then(
      (state) => isActive && setLoaded({ projectId, state }),
      (error: unknown) => {
        console.error('Không đọc được thẻ mô hình', error);
        if (isActive) setLoaded({ projectId, state: { status: 'error' } });
      },
    );
    return () => {
      isActive = false;
    };
  }, [repos, projectId]);

  if (!loaded || loaded.projectId !== projectId) return <p role="status" className="text-muted">{t('modelCard.loading')}</p>;
  const { state } = loaded;
  if (state.status !== 'ready') {
    return (
      <p role="alert" className="rounded border border-danger p-3 text-danger">
        {t(state.status === 'not-found' ? 'project.notFound' : 'project.loadError')}
      </p>
    );
  }
  return <ModelCardEditor key={state.project.id} {...state} onSaved={(saved, updatedAt) => setLoaded({ projectId, state: { ...state, saved, updatedAt } })} />;
}

interface EditorProps {
  readonly project: ProjectRecord;
  readonly facts: ModelCardFacts;
  readonly saved: ModelCardFields;
  readonly updatedAt: string | null;
  readonly onSaved: (saved: ModelCardFields, updatedAt: string) => void;
}

function ModelCardEditor({ project, facts, saved, updatedAt, onSaved }: EditorProps) {
  const { t, i18n } = useTranslation();
  const repos = useRepositories();
  const [draft, setDraft] = useState<ModelCardFields>(saved);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<SaveMessage>(null);
  const missing = missingModelCardFields(saved);
  const isDirty = MODEL_CARD_TEXT_FIELDS.some((f) => draft[f] !== saved[f]) || draft.authors !== saved.authors;

  const update = (field: keyof ModelCardFields, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const card = await repos.modelCards.save(project.id, draft);
      const fields = pickModelCardFields(card);
      setDraft(fields);
      onSaved(fields, card.updatedAt);
      setMessage({ kind: 'saved' });
    } catch (err: unknown) {
      setMessage({ kind: 'error', message: t('modelCard.saveError', { message: getErrorMessage(err) }) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <BackLink to={`/studio/${project.id}`} className="print:hidden">
          {t('modelCard.backToProject')}
        </BackLink>
        <p className="font-mono text-xs uppercase text-accent">{t('modelCard.title')}</p>
        <h1 className="font-display text-4xl font-bold">{project.name}</h1>
        <p className="max-w-3xl text-muted print:hidden">{t('modelCard.lead')}</p>
        {updatedAt && <p className="text-xs text-muted">{t('modelCard.updatedAt', { date: new Date(updatedAt).toLocaleString(i18n.language) })}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] print:block">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 print:hidden" aria-label={t('modelCard.title')}>
          {/* Chỉ đọc khi đang lưu: chữ gõ thêm không bị bản vừa lưu ghi đè, mà con trỏ vẫn ở nguyên ô. */}
          <div className="space-y-5">
            <div>
              <label htmlFor="model-card-authors" className="mb-1 block font-medium">{t('modelCard.authors')}</label>
              <input
                id="model-card-authors"
                value={draft.authors}
              readOnly={isSaving}
                maxLength={MODEL_CARD_AUTHORS_MAX_LENGTH}
                placeholder={t('modelCard.authorsPlaceholder')}
                onChange={(e) => update('authors', e.target.value)}
                className="w-full rounded border border-rule bg-paper px-3 py-2"
              />
            </div>
            {MODEL_CARD_TEXT_FIELDS.map((field) => (
              <div key={field}>
                <label htmlFor={`model-card-${field}`} className="mb-1 block font-medium">{t(`modelCard.fields.${field}.label`)}</label>
                <p id={`model-card-${field}-hint`} className="mb-1 text-xs text-muted">{t(`modelCard.fields.${field}.hint`)}</p>
                <textarea
                  id={`model-card-${field}`}
                  aria-describedby={`model-card-${field}-hint`}
                  value={draft[field]}
                readOnly={isSaving}
                  maxLength={MODEL_CARD_TEXT_MAX_LENGTH}
                  rows={3}
                  onChange={(e) => update(field, e.target.value)}
                  className="w-full rounded border border-rule bg-paper p-2"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
              {isSaving ? t('modelCard.saving') : t('modelCard.save')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer /> {t('modelCard.print')}
            </button>
            {isDirty && <span className="text-sm text-warning">{t('modelCard.unsaved')}</span>}
          </div>
          {/* Vùng thông báo luôn có sẵn để trình đọc màn hình đọc được khi nội dung đổi. */}
          <p role="status" className="text-sm text-accent empty:hidden">{message?.kind === 'saved' ? t('modelCard.saved') : ''}</p>
          <p role="alert" className="text-sm text-danger empty:hidden">{message?.kind === 'error' ? message.message : ''}</p>
        </form>

        <aside className="space-y-4">
          <p data-testid="model-card-completeness" className={`rounded border p-3 text-sm print:hidden ${missing.length === 0 ? 'border-accent text-accent' : 'border-rule'}`}>
            {missing.length === 0
              ? <><Check /> {t('modelCard.complete')}</>
              : t('modelCard.missing', { fields: missing.map((f) => t(`modelCard.fields.${f}.short`)).join(', ') })}
          </p>
          <FactsPanel facts={facts} />
        </aside>
      </div>

      <PrintedCard card={draft} />
    </div>
  );
}

/** Bản in: đúng những gì đang thấy trong ô nhập, dạng văn bản (ô nhập liệu in ra bị cắt chữ). */
function PrintedCard({ card }: { readonly card: ModelCardFields }) {
  const { t } = useTranslation();
  return (
    <dl className="hidden space-y-3 print:block" data-testid="model-card-print">
      {card.authors && (
        <div>
          <dt className="font-semibold">{t('modelCard.authors')}</dt>
          <dd>{card.authors}</dd>
        </div>
      )}
      {MODEL_CARD_TEXT_FIELDS.map((field) => (
        <div key={field}>
          <dt className="font-semibold">{t(`modelCard.fields.${field}.label`)}</dt>
          <dd className="whitespace-pre-wrap">{card[field] || t('modelCard.noAnswer')}</dd>
        </div>
      ))}
    </dl>
  );
}
