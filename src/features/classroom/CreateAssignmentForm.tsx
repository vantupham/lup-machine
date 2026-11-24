import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectRecord } from '@/storage/db';
import { useRepositories } from '@/storage/repository-context';
import { PROJECT_TYPES } from '@/storage/schemas/manifest';
import type { ProjectType } from '@/storage/schemas/project';
import { ASSIGNMENT_LIMITS, type RubricCriterion } from '@/storage/schemas/assignment';
import { downloadBytes } from '@/ui/download';
import { getErrorMessage } from '@/ui/error-message';
import { createAssignmentFile } from './classroom-files';
import { QuestionsEditor } from './QuestionsEditor';
import { RubricEditor } from './RubricEditor';

type Translate = ReturnType<typeof useTranslation>['t'];
type Status = { readonly kind: 'idle' | 'busy' } | { readonly kind: 'done'; readonly file: string } | { readonly kind: 'error'; readonly message: string };

function defaultRubric(t: Translate): RubricCriterion[] {
  return [
    { criterion: t('classroom.defaultRubric.dataName'), description: t('classroom.defaultRubric.dataDescription'), maxPoints: 3 },
    { criterion: t('classroom.defaultRubric.modelName'), description: t('classroom.defaultRubric.modelDescription'), maxPoints: 4 },
    { criterion: t('classroom.defaultRubric.cardName'), description: t('classroom.defaultRubric.cardDescription'), maxPoints: 3 },
  ];
}

/** Lỗi nhập liệu thường gặp, báo bằng lời dễ hiểu trước khi kiểm tra bằng schema. */
function validationError(t: Translate, title: string, questions: readonly string[], rubric: readonly RubricCriterion[]): string | null {
  if (title.trim() === '') return t('classroom.create.titleRequired');
  if (questions.some((q) => q.trim() === '')) return t('classroom.create.questionRequired');
  if (rubric.some((c) => c.criterion.trim() === '')) return t('classroom.create.criterionRequired');
  return null;
}

export function CreateAssignmentForm() {
  const { t } = useTranslation();
  const repos = useRepositories();
  const [title, setTitle] = useState('');
  const [teacher, setTeacher] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('image');
  const [instructions, setInstructions] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [rubric, setRubric] = useState<RubricCriterion[]>(() => defaultRubric(t));
  const [starterId, setStarterId] = useState('');
  const [projects, setProjects] = useState<readonly ProjectRecord[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    let isActive = true;
    repos.projects.findAll().then(
      (all) => isActive && setProjects(all),
      (error: unknown) => console.error('Không đọc được danh sách dự án', error),
    );
    return () => {
      isActive = false;
    };
  }, [repos]);

  const starters = projects.filter((p) => p.projectType === projectType);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validationError(t, title, questions, rubric);
    if (invalid) {
      setStatus({ kind: 'error', message: invalid });
      return;
    }
    setStatus({ kind: 'busy' });
    try {
      const draft = { title, teacher, instructions, projectType, questions, rubric };
      const file = await createAssignmentFile(repos, draft, starters.some((p) => p.id === starterId) ? starterId : null);
      downloadBytes(file.fileName, file.bytes);
      setStatus({ kind: 'done', file: file.fileName });
    } catch (err: unknown) {
      setStatus({ kind: 'error', message: t('classroom.create.error', { message: getErrorMessage(err) }) });
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate aria-labelledby="create-assignment-title" className="lab-card space-y-6 p-5">
      <h2 id="create-assignment-title" className="text-xl font-semibold">{t('classroom.create.title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="assignment-title" label={t('classroom.create.titleLabel')} value={title} onChange={setTitle} max={ASSIGNMENT_LIMITS.title} placeholder={t('classroom.create.titlePlaceholder')} />
        <TextField id="assignment-teacher" label={t('classroom.create.teacherLabel')} value={teacher} onChange={setTeacher} max={ASSIGNMENT_LIMITS.teacher} placeholder={t('classroom.create.teacherPlaceholder')} />
      </div>
      <fieldset>
        <legend className="mb-2 font-semibold">{t('classroom.create.typeLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_TYPES.map((type) => (
            <label key={type} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm ${projectType === type ? 'border-primary' : 'border-rule'}`}>
              <input type="radio" name="assignment-type" checked={projectType === type} onChange={() => setProjectType(type)} />
              {t(`studio.types.${type}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="assignment-instructions" className="mb-1 block font-semibold">{t('classroom.create.instructionsLabel')}</label>
        <textarea
          id="assignment-instructions"
          value={instructions}
          maxLength={ASSIGNMENT_LIMITS.instructions}
          rows={5}
          placeholder={t('classroom.create.instructionsPlaceholder')}
          onChange={(e) => setInstructions(e.target.value)}
          className="w-full rounded border border-rule bg-paper p-2"
        />
      </div>
      <QuestionsEditor questions={questions} onChange={setQuestions} />
      <RubricEditor rubric={rubric} onChange={setRubric} />
      <div>
        <label htmlFor="assignment-starter" className="mb-1 block font-semibold">{t('classroom.create.starterLabel')}</label>
        <select id="assignment-starter" value={starterId} onChange={(e) => setStarterId(e.target.value)} className="w-full rounded border border-rule bg-paper px-3 py-2">
          <option value="">{t('classroom.create.starterNone')}</option>
          {starters.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">{t('classroom.create.starterHint')}</p>
      </div>
      <button type="submit" className="btn btn-primary" disabled={status.kind === 'busy'}>
        {status.kind === 'busy' ? t('classroom.create.creating') : t('classroom.create.download')}
      </button>
      <p role="status" className="text-sm text-accent empty:hidden">{status.kind === 'done' ? t('classroom.create.created', { file: status.file }) : ''}</p>
      <p role="alert" className="text-sm text-danger empty:hidden">{status.kind === 'error' ? status.message : ''}</p>
    </form>
  );
}

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly max: number;
  readonly placeholder: string;
}

function TextField({ id, label, value, onChange, max, placeholder }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">{label}</label>
      <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full rounded border border-rule bg-paper px-3 py-2" />
    </div>
  );
}
