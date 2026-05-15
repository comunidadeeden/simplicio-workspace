import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownUp, BrainCircuit, ChevronDown, Filter, RefreshCw, Search, Sparkles, Target, Ticket, Users } from 'lucide-react';
import { defaultIntegrationSettings, subscribeIntegrationSettings } from '../lib/integrations';
import { loadLeadScoreData, type LeadTemperature, type ScoredLead } from '../lib/leads';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const inputClass = 'h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600';

type LoadStatus = 'loading' | 'ready' | 'error';
type TemperatureFilter = 'Todos' | LeadTemperature;
type StageFilter = 'Todos' | 'Comprou ingresso' | 'Comprou Éden' | 'Outro produto';
type SortKey = 'score' | 'date' | 'amount' | 'name';
type SortDirection = 'asc' | 'desc';

export function Leads() {
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [message, setMessage] = useState('Carregando leads da planilha...');
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState<TemperatureFilter>('Todos');
  const [stage, setStage] = useState<StageFilter>('Todos');
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedLeadId, setExpandedLeadId] = useState<string>('');

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

  const filteredLeads = useMemo(() => {
    const filtered = leads.filter((lead) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [lead.name, lead.email, lead.phone, lead.product, lead.campaign, lead.source, lead.location, lead.paymentMethod].join(' ').toLowerCase().includes(query);
      const matchesTemperature = temperature === 'Todos' || lead.temperature === temperature;
      const matchesStage = stage === 'Todos' || lead.stage === stage;
      return matchesSearch && matchesTemperature && matchesStage;
    });
    return filtered.sort((a, b) => compareLeads(a, b, sortKey, sortDirection));
  }, [leads, search, sortDirection, sortKey, stage, temperature]);

  const hotLeads = leads.filter((lead) => lead.temperature === 'Quente');
  const workshopLeads = leads.filter((lead) => lead.stage === 'Comprou ingresso');
  const edenLeads = leads.filter((lead) => lead.stage === 'Comprou Éden');
  const averageScore = leads.length ? Math.round(leads.reduce((total, lead) => total + lead.score, 0) / leads.length) : 0;
  const potentialRevenue = hotLeads.filter((lead) => lead.stage !== 'Comprou Éden').length * 697;

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((value) => value === 'desc' ? 'asc' : 'desc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  };

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
          <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-300"><Filter size={14} className="text-blue-400" />Filtros e ordenação</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5 xl:w-[980px]">
            <div className="relative xl:col-span-2"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input className={cn(inputClass, 'w-full pl-8')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lead, campanha, origem ou produto" /></div>
            <select className={cn(inputClass, 'w-full')} value={temperature} onChange={(event) => setTemperature(event.target.value as TemperatureFilter)}><option>Todos</option><option>Quente</option><option>Morno</option><option>Frio</option></select>
            <select className={cn(inputClass, 'w-full')} value={stage} onChange={(event) => setStage(event.target.value as StageFilter)}><option>Todos</option><option>Comprou ingresso</option><option>Comprou Éden</option><option>Outro produto</option></select>
            <select className={cn(inputClass, 'w-full')} value={`${sortKey}:${sortDirection}`} onChange={(event) => { const [key, direction] = event.target.value.split(':') as [SortKey, SortDirection]; setSortKey(key); setSortDirection(direction); }}>
              <option value="score:desc">Maior score</option>
              <option value="score:asc">Menor score</option>
              <option value="date:desc">Mais recentes</option>
              <option value="date:asc">Mais antigos</option>
              <option value="amount:desc">Maior valor</option>
              <option value="name:asc">Nome A-Z</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] leading-5 text-slate-600">Colunas reconhecidas: {columns.length ? columns.slice(0, 18).join(', ') : 'aguardando leitura da planilha'}</p>
      </section>

      <section className="rounded-2xl border border-slate-900/60 bg-slate-950">
        <div className="grid grid-cols-[minmax(220px,1.45fr)_96px_132px_120px_minmax(140px,1fr)_110px_34px] gap-3 border-b border-slate-900 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600 max-xl:hidden">
          <SortHeader label="Lead" active={sortKey === 'name'} direction={sortDirection} onClick={() => setSort('name')} />
          <SortHeader label="Score" active={sortKey === 'score'} direction={sortDirection} onClick={() => setSort('score')} />
          <span>Estágio</span>
          <SortHeader label="Valor" active={sortKey === 'amount'} direction={sortDirection} onClick={() => setSort('amount')} />
          <span>Origem</span>
          <SortHeader label="Data" active={sortKey === 'date'} direction={sortDirection} onClick={() => setSort('date')} />
          <span />
        </div>
        <div className="divide-y divide-slate-900/80">
          {filteredLeads.map((lead) => <div key={lead.id}><LeadListItem lead={lead} expanded={expandedLeadId === lead.id} onToggle={() => setExpandedLeadId((value) => value === lead.id ? '' : lead.id)} /></div>)}
          {!filteredLeads.length && <EmptyText text="Nenhum lead encontrado com os filtros atuais." />}
        </div>
      </section>
    </div>
  );
}

function LeadListItem({ lead, expanded, onToggle }: { lead: ScoredLead; expanded: boolean; onToggle: () => void }) {
  return (
    <article className="px-4 py-3">
      <button type="button" onClick={onToggle} className="grid w-full grid-cols-1 gap-3 text-left xl:grid-cols-[minmax(220px,1.45fr)_96px_132px_120px_minmax(140px,1fr)_110px_34px] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2"><p className="truncate text-[13px] font-semibold text-slate-100">{lead.name}</p><Badge temperature={lead.temperature} /></div>
          <p className="mt-1 truncate text-[11px] text-slate-500">{lead.email || lead.phone || 'sem contato identificado'}</p>
        </div>
        <div><p className="font-mono text-lg font-bold text-slate-100">{lead.score}</p><p className="text-[10px] text-slate-600 xl:hidden">score</p></div>
        <div><span className="rounded-full border border-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{lead.stage}</span></div>
        <div className="font-mono text-[12px] text-slate-300">{money.format(lead.amount)}</div>
        <div className="min-w-0"><p className="truncate text-[12px] text-slate-400">{lead.source || lead.campaign || 'Não identificada'}</p><p className="mt-1 truncate text-[10px] text-slate-600">{lead.product}</p></div>
        <div className="font-mono text-[11px] text-slate-500">{formatDate(lead.date)}</div>
        <ChevronDown size={15} className={cn('text-slate-600 transition-transform max-xl:hidden', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="mt-4 rounded-xl border border-slate-900 bg-slate-950/70 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Telefone" value={lead.phone || 'Não identificado'} />
            <MiniStat label="Documento" value={lead.document || 'Não identificado'} />
            <MiniStat label="Localização" value={lead.location || 'Não identificada'} />
            <MiniStat label="Pagamento" value={lead.paymentMethod || 'Não identificado'} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {lead.signals.map((signal) => <span key={signal} className="rounded-full border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-400">{signal}</span>)}
          </div>
          {lead.usefulFields.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {lead.usefulFields.slice(0, 9).map((field) => <div key={`${field.label}-${field.value}`}><MiniStat label={field.label} value={field.value} /></div>)}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SortHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn('flex items-center gap-1 text-left transition-colors hover:text-slate-300', active && 'text-blue-400')}><span>{label}</span><ArrowDownUp size={11} className={cn(active ? 'opacity-100' : 'opacity-40', direction === 'asc' && 'rotate-180')} /></button>;
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
  return <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest', tone)}>{temperature}</span>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-900 bg-slate-950/70 p-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{label}</p><p className="mt-1 truncate font-mono text-[12px] text-slate-300">{value}</p></div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="p-4 text-[12px] text-slate-500">{text}</p>;
}

function compareLeads(a: ScoredLead, b: ScoredLead, key: SortKey, direction: SortDirection) {
  const multiplier = direction === 'desc' ? -1 : 1;
  if (key === 'name') return a.name.localeCompare(b.name) * multiplier;
  if (key === 'date') return a.date.localeCompare(b.date) * multiplier;
  if (key === 'amount') return (a.amount - b.amount) * multiplier;
  return (a.score - b.score) * multiplier;
}

function formatDate(date: string) {
  if (!date) return 'sem data';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}
