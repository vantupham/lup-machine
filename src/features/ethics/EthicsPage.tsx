import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DATA_FLOW, SCENARIOS, SCENARIOS_LEAD, SCENARIOS_TITLE, type DataFlowItem } from '@/content/ethics/ethics';
import { BiasLab } from './BiasLab';

/** Phòng đạo đức AI (#/dao-duc): thí nghiệm thiên lệch, dữ liệu đi đâu, tình huống thảo luận. */
export function EthicsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl font-bold">{t('ethics.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t('ethics.lead')}</p>
      </header>
      <BiasLab />
      <DataFlow />
      <Scenarios />
    </div>
  );
}

function FlowColumn({ title, items, tone }: { readonly title: string; readonly items: readonly DataFlowItem[]; readonly tone: string }) {
  return (
    <div className={`space-y-2 rounded border-t-4 bg-surface p-4 ${tone}`}>
      <h3 className="font-semibold">{title}</h3>
      <ul lang="vi" className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.where}>
            <span className="font-medium">{item.where}</span>
            <span className="block">{item.what}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sơ đồ "Dữ liệu của em đi đâu?": ở lại trên máy, tải về từ trang, chỉ rời máy khi em xuất tệp. */
function DataFlow() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="data-flow-title" className="lab-card space-y-4 p-5">
      <h2 id="data-flow-title" lang="vi" className="font-display text-2xl font-bold">{DATA_FLOW.title}</h2>
      <p lang="vi">{DATA_FLOW.lead}</p>
      <div className="grid gap-4 md:grid-cols-3" data-testid="data-flow">
        <FlowColumn title={t('ethics.flow.downloads')} items={DATA_FLOW.downloads} tone="border-rule" />
        <FlowColumn title={t('ethics.flow.stays')} items={DATA_FLOW.stays} tone="border-accent" />
        <FlowColumn title={t('ethics.flow.leaves')} items={DATA_FLOW.leaves} tone="border-primary" />
      </div>
      <p lang="vi" className="font-medium">{DATA_FLOW.never}</p>
      <ul lang="vi" className="list-disc space-y-1 pl-5 text-sm">
        {DATA_FLOW.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}

function Scenarios() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="scenarios-title" className="space-y-4">
      <h2 id="scenarios-title" lang="vi" className="font-display text-2xl font-bold">{SCENARIOS_TITLE}</h2>
      <p className="max-w-3xl">
        <span lang="vi">{SCENARIOS_LEAD}</span> <Link to="/studio" className="text-primary underline">{t('ethics.openStudio')}</Link>
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((s) => (
          <article key={s.id} lang="vi" aria-labelledby={`scenario-${s.id}`} className="lab-card space-y-2 p-5">
            <h3 id={`scenario-${s.id}`} className="text-lg font-semibold">{s.title}</h3>
            <p className="text-sm">{s.situation}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {s.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
