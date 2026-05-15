import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BrainCircuit, Filter, RefreshCw, Search, Sparkles, Target, Ticket, Users } from 'lucide-react';
import { defaultIntegrationSettings, subscribeIntegrationSettings } from '../lib/integrations';
import { loadLeadScoreData, type LeadTemperature, type ScoredLead } from '../lib/leads';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const inputClass = 'h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600';

type LoadStatus = 'loading' | 'ready' | 'error';
type TemperatureFilter = 'Todos' | LeadTemperature;
type StageFilter = 'Todos' | 'Comprou ingresso' | 'Comprou Éden' | 'Outro produto';

export function Leads() {
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [message, setMessage] = useState('Carregando leads da planilha...');
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState<TemperatureFilter>('Todos');
  const [stage, setStage] = useState<StageFilter>('Todos');

  useEffect(() => {
    return subscribeIntegrationSettings(
      (settings) => {
        setStatus('loading');
        loadLeadScoreData(settings).then((result) => {
          setLeads(result.leads);
          setColumns(result.columns);
          setStatus(result.errors.length ? 'error' : 'ready');
          setMessage(result.errors.length ? result.errors.join(' | ') : `${number.format(result.leads.length)} lead(s) classificados pela planilha.`);
        });
      },
      () => {
        loadLeadScoreData(defaultIntegrationSettings).then((result) => {
          setLeads(result.leads);
          setColumns(result.columns);
          setStatus(result.errors.length ? 'error' : 'ready');
          setMessage(result.errors.length ? result.errors.join(' | ') : `${number.format(result.leads.length)} lead(s) classificados pela planilha.`);
        });
      },
    );
  }, []);

  const filteredLeads = useMemo(() => leads.filter((lead) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [lead.name, lead.email, lead.phone, lead.product, lead.campaign, lead.source].join(' ').toLowerCase().includes(query);
    const matchesTemperature = temperature === 'Todos' || lead.temperature === temperature;
    const matchesStage = stage === 'Todos' || lead.stage === stage;
    return matchesSearch && matchesTemperature && matchesStage;
  }), [leads, search, stage, temperature]);

  const hotLeads = leads.filter((lead) => lead.temperature === 'Quente');
  const workshopLeads = leads.filter((lead) => lead.stage === 'Comprou ingresso');
  const edenLeads = leads.filter((lead) => lead.stage === 'Comprou Éden');
  const averageScore = leads.length ? Math.round(leads.reduce((total, lead) => total + lead.score, 0) / leads.length) : 0;
  const potentialRevenue = hotLeads.filter((lead) => lead.stage !== 'Comprou Éden').length * 697;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Lead score</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Leads</h1>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-500">Classifique quem compra o ingresso do workshop e descubra quais leads têm mais chance de assistir a live e comprar a comunidade Éden.</p>
        </div>
        <StatusBanner status={status} message={message} />
      </div>

      {status === 'error' && (
        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-[12px] leading-5 text-amber-100">
          <div className="flex gap-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-semibold">Não consegui ler a planilha de vendas agora.</p><p className="mt-1 text-amber-200/80">A aba está pronta, mas precisa que a planilha esteja publicada para CSV ou acessível pela conexão configurada.</p></div></div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Leads classificados" value={number.format(leads.length)} detail={`${number.format(filteredLeads.length)} no filtro`} icon={Users} tone="blue" />
        <MetricCard label="Quentes" value={number.format(hotLeads.length)} detail="Score 75+" icon={Sparkles} tone="green" />
        <MetricCard label="Ingressos" value={number.format(workshopLeads.length)} detail="Entraram no funil" icon={Ticket} tone="amber" />
        <MetricCard label="Compraram Éden" value={number.format(edenLeads.length)} detail="Conversão final" icon={Target} tone="green" />
        <MetricCard label="Receita potencial" value={money.format(potentialRevenue)} detail={`Score médio ${averageScore}`} icon={BrainCircuit} tone="blue" />
      </section>

      <section className="rounded-2xl border border-slate-900/60 bg-slate-950 p-4">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-300"><Filter size={14} className="text-blue-400" />Filtros de score</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:w-[760px]">
            <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input className={cn(inputClass, 'w-full pl-8')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lead, campanha ou produto" /></div>
            <select className={cn(inputClass, 'w-full')} value={temperature} onChange={(event) => setTemperature(event.target.value as TemperatureFilter)}><option>Todos</option><option>Quente</option><option>Morno</option><option>Frio</option></select>
            <select className={cn(inputClass, 'w-full')} value={stage} onChange={(event) => setStage(event.target.value as StageFilter)}><option>Todos</option><option>Comprou ingresso</option><option>Comprou Éden</option><option>Outro produto</option></select>
          </div>
        </div>
        <p className="text-[11px] leading-5 text-slate-600">Colunas detectadas: {columns.length ? columns.slice(0, 12).join(', ') : 'aguardando leitura da planilha'}</p>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-3">
          {filteredLeads.map((lead) => <div key={lead.id}><LeadRow lead={lead} /></div>)}
          {!filteredLeads.length && <EmptyText text="Nenhum lead encontrado com os filtros atuais." />}
        </div>
        <aside className="xl:col-span-4 space-y-4">
          <Panel title="Como o score nasce" icon={<BrainCircuit size={15} />}>
            <div className="space-y-3 text-[12px] leading-5 text-slate-500">
              <Insight title="Entrada no funil" text="Comprar ingresso do Workshop Bússola da Cura aumenta bastante a nota, porque é o primeiro compromisso pago." />
              <Insight title="Sinais de contato" text="E-mail, WhatsApp, campanha e status aprovado melhoram a confiabilidade e a chance de abordagem." />
              <Insight title="IA no próximo passo" text="A IA vai ler respostas abertas, dores e intenção para explicar por que um lead é quente ou frio." />
            </div>
          </Panel>
          <Panel title="Próximas conexões" icon={<Sparkles size={15} />}>
            <ul className="space-y-2 text-[12px] leading-5 text-slate-500">
              <li>Presença na live para recalcular score depois do evento.</li>
              <li>Eventos de WhatsApp e checkout abandonado.</li>
              <li>Histórico de compradores antigos para calibrar pesos.</li>
            </ul>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function LeadRow({ lead }: { lead: ScoredLead }) {
  return (
    <article className="rounded-2xl border border-slate-900/60 bg-slate-950 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-slate-100">{lead.name}</h2>
            <Badge temperature={lead.temperature} />
            <span className="rounded-full border border-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{lead.stage}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-500">{lead.email || 'sem e-mail'} · {lead.phone || 'sem telefone'}</p>
          <p className="mt-2 text-[12px] text-slate-400">{lead.product}</p>
        </div>
        <div className="text-left md:text-right">
          <p className="font-mono text-3xl font-bold text-slate-100">{lead.score}</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">score</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-900 pt-4 md:grid-cols-3">
        <MiniStat label="Valor" value={money.format(lead.amount)} />
        <MiniStat label="Origem" value={lead.source || 'Não identificada'} />
        <MiniStat label="Campanha" value={lead.campaign || 'Não identificada'} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {lead.signals.map((signal) => <span key={signal} className="rounded-full border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-400">{signal}</span>)}
      </div>
    </article>
  );
}

function StatusBanner({ status, message }: { status: LoadStatus; message: string }) {
  const tone = status === 'ready' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : status === 'loading' ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return <div className={cn('max-w-xl rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5', tone)}>{status === 'loading' && <RefreshCw size={12} className="mr-2 inline animate-spin" />}{message}</div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Users; tone: 'blue' | 'green' | 'amber' }) {
  const tones = { blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-300' };
  return <div className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold tracking-tighter text-slate-100">{value}</p></div><div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50', tones[tone])}><Icon size={15} /></div></div><p className="mt-2 text-[11px] text-slate-600">{detail}</p></div>;
}

function Badge({ temperature }: { temperature: LeadTemperature }) {
  const tone = temperature === 'Quente' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : temperature === 'Morno' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-slate-800 bg-slate-900/60 text-slate-400';
  return <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest', tone)}>{temperature}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-900 bg-slate-950/70 p-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{label}</p><p className="mt-1 truncate font-mono text-[12px] text-slate-300">{value}</p></div>;
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-900/60 bg-slate-950 p-5"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="text-blue-400">{icon}</span>{title}</h2>{children}</section>;
}

function Insight({ title, text }: { title: string; text: string }) {
  return <div className="rounded-lg border border-slate-900 bg-slate-950/70 p-3"><p className="font-semibold text-slate-300">{title}</p><p className="mt-1">{text}</p></div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-lg border border-slate-900 bg-slate-950/70 p-4 text-[12px] text-slate-500">{text}</p>;
}
