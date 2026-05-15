import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Filter, PieChart as PieChartIcon, RefreshCw, Target, TrendingUp, Wallet } from 'lucide-react';
import { type SalesRevenuePoint, type TrafficSpendPoint } from '../lib/finance';
import { defaultIntegrationSettings, loadSheetData, subscribeIntegrationSettings } from '../lib/integrations';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#38bdf8', '#a78bfa', '#64748b'];
const inputClass = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40';

type LoadStatus = 'loading' | 'ready' | 'error';
type PeriodPreset = 'all' | '7d' | '30d' | 'month' | 'custom';

export function Dashboard() {
  const [revenue, setRevenue] = useState<SalesRevenuePoint[]>([]);
  const [traffic, setTraffic] = useState<TrafficSpendPoint[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sheetMessage, setSheetMessage] = useState('Carregando planilhas configuradas...');
  const [productFilter, setProductFilter] = useState('Todos');
  const [accountFilter, setAccountFilter] = useState('Todas');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    return subscribeIntegrationSettings(
      (settings) => {
        setStatus('loading');
        loadSheetData(settings).then((result) => {
          setRevenue(result.sales);
          setTraffic(result.traffic);
          setStatus(result.errors.length ? 'error' : 'ready');
          setSheetMessage(result.errors.length ? `Planilhas não carregadas: ${result.errors.join(' | ')}` : 'Dados reais sincronizados das planilhas.');
        });
      },
      () => {
        loadSheetData(defaultIntegrationSettings).then((result) => {
          setRevenue(result.sales);
          setTraffic(result.traffic);
          setStatus(result.errors.length ? 'error' : 'ready');
          setSheetMessage(result.errors.length ? `Planilhas não carregadas: ${result.errors.join(' | ')}` : 'Dados reais sincronizados das planilhas.');
        });
      },
    );
  }, []);

  const productOptions = useMemo(() => ['Todos', ...unique(revenue.map((item) => item.platform))], [revenue]);
  const accountOptions = useMemo(() => ['Todas', ...unique(traffic.map((item) => item.account))], [traffic]);
  const dateRange = useMemo(() => resolveDateRange(periodPreset, customStart, customEnd), [customEnd, customStart, periodPreset]);

  const filteredRevenue = useMemo(() => revenue.filter((item) => {
    const matchesProduct = productFilter === 'Todos' || item.platform === productFilter;
    return matchesProduct && matchesDate(item.date, dateRange.start, dateRange.end);
  }), [dateRange.end, dateRange.start, productFilter, revenue]);

  const filteredTraffic = useMemo(() => traffic.filter((item) => {
    const matchesAccount = accountFilter === 'Todas' || item.account === accountFilter;
    return matchesAccount && matchesDate(item.date, dateRange.start, dateRange.end);
  }), [accountFilter, dateRange.end, dateRange.start, traffic]);

  const totalRevenue = sum(filteredRevenue.map((item) => item.revenue));
  const totalOrders = sum(filteredRevenue.map((item) => item.orders));
  const totalTraffic = sum(filteredTraffic.map((item) => item.spend));
  const roas = totalTraffic ? totalRevenue / totalTraffic : 0;
  const averageTicket = totalRevenue / Math.max(totalOrders, 1);
  const mediaShare = totalRevenue ? Math.round((totalTraffic / totalRevenue) * 100) : 0;
  const contribution = totalRevenue - totalTraffic;

  const trafficByAccount = useMemo(() => groupTrafficByAccount(filteredTraffic), [filteredTraffic]);
  const productData = useMemo(() => groupRevenueByProduct(filteredRevenue), [filteredRevenue]);
  const dailyFlow = useMemo(() => mergeDailyFlow(filteredRevenue, filteredTraffic), [filteredRevenue, filteredTraffic]);
  const topProducts = productData.slice().sort((a, b) => b.value - a.value).slice(0, 5);

  const resetSegmentFilters = () => {
    setProductFilter('Todos');
    setAccountFilter('Todas');
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Comando da operação</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">Analise faturamento, mídia, ROAS e mix de produtos com filtros de gestão.</p>
        </div>
        <div className="flex w-full flex-col gap-3 xl:w-auto xl:items-end">
          <StatusBanner status={status} message={sheetMessage} />
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="min-w-[170px]">
              <select className={inputClass} value={periodPreset} onChange={(event) => setPeriodPreset(event.target.value as PeriodPreset)} aria-label="Selecionar período">
                <option value="all">Todo período</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="month">Mês atual</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            {periodPreset === 'custom' && (
              <>
                <input className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Data inicial" />
                <input className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Data final" />
              </>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-pressed={showFilters}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                showFilters ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-200',
              )}
            >
              <Filter size={15} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <CalendarDays size={12} />
            <span>{describeRange(dateRange.start, dateRange.end)}</span>
          </div>
        </div>
      </div>

      {showFilters && (
        <section className="rounded-2xl border border-slate-900/60 bg-slate-950 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-300"><Filter size={14} className="text-blue-400" />Filtros</div>
            <button onClick={resetSegmentFilters} className="rounded-lg border border-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-100">Limpar</button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Produto"><select className={inputClass} value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>{productOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
            <Field label="Conta de anúncio"><select className={inputClass} value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>{accountOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Faturamento" value={money.format(totalRevenue)} detail={`${number.format(totalOrders)} pedido(s)`} icon={TrendingUp} tone="blue" positive />
        <MetricCard label="Mídia paga" value={money.format(totalTraffic)} detail={`${number.format(filteredTraffic.length)} linha(s) de tráfego`} icon={ArrowDownRight} tone="amber" />
        <MetricCard label="ROAS" value={roas.toFixed(2).replace('.', ',')} detail="Receita / mídia" icon={Target} tone={roas >= 2 ? 'green' : roas >= 1 ? 'amber' : 'rose'} positive={roas >= 1} />
        <MetricCard label="Ticket médio" value={money.format(averageTicket)} detail="Receita por pedido" icon={Wallet} tone="green" positive />
        <MetricCard label="Contribuição" value={money.format(contribution)} detail={`${mediaShare}% da receita em mídia`} icon={ArrowUpRight} tone={contribution >= 0 ? 'green' : 'rose'} positive={contribution >= 0} />
      </section>

      {status === 'error' && (
        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-[12px] leading-5 text-amber-100">
          <div className="flex gap-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-semibold">As planilhas ainda não estão públicas para leitura CSV.</p><p className="mt-1 text-amber-200/80">No Google Sheets, use Compartilhar/Publicar na Web ou uma URL CSV publicada. Enquanto isso, o Dashboard fica zerado para não misturar dados reais com demonstração.</p></div></div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-8" title="Receita e mídia por dia" description="Compare entrada de vendas com investimento em anúncios no período filtrado.">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyFlow}>
                <defs><linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.16}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient><linearGradient id="dashSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.14}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="#0f172a" vertical={false} />
                <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                <Area type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} fill="url(#dashRevenue)" />
                <Area type="monotone" dataKey="midia" stroke="#f59e0b" strokeWidth={2} fill="url(#dashSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="Contas de anúncio" description="Distribuição do gasto por conta.">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={trafficByAccount} innerRadius={56} outerRadius={88} dataKey="value" paddingAngle={3}>
                  {trafficByAccount.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">{trafficByAccount.slice(0, 5).map((item, index) => <div key={item.name}><SummaryLine label={item.name} value={money.format(item.value)} color={COLORS[index % COLORS.length]} /></div>)}</div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-4" title="Mix de produtos" description="Participação do faturamento por produto.">
          <div className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={productData} innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={3}>{productData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} /></PieChart></ResponsiveContainer></div>
        </Panel>
        <Panel className="xl:col-span-4" title="Ranking de produtos" description="Onde a receita está concentrada.">
          <div className="space-y-3">{topProducts.length ? topProducts.map((item, index) => <div key={item.name}><RankLine index={index + 1} label={item.name} value={money.format(item.value)} percent={totalRevenue ? Math.round((item.value / totalRevenue) * 100) : 0} /></div>) : <EmptyText text="Sem produtos no período." />}</div>
        </Panel>
        <Panel className="xl:col-span-4" title="Vendas recentes" description="Últimos registros encontrados na planilha.">
          <div className="space-y-3">{filteredRevenue.slice(-6).reverse().map((item, index) => <div key={`${item.date}-${index}`}><SummaryLine label={`${item.platform} · ${item.label}`} value={money.format(item.revenue)} /></div>)}{!filteredRevenue.length && <EmptyText text="Sem vendas no período." />}</div>
        </Panel>
      </section>
    </div>
  );
}

function StatusBanner({ status, message }: { status: LoadStatus; message: string }) {
  const tone = status === 'ready' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : status === 'loading' ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return <div className={cn('max-w-xl rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5', tone)}>{status === 'loading' && <RefreshCw size={12} className="mr-2 inline animate-spin" />}{message}</div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone, positive }: { label: string; value: string; detail: string; icon: typeof TrendingUp; tone: 'blue' | 'green' | 'amber' | 'rose'; positive?: boolean }) {
  const tones = { blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold tracking-tighter text-slate-100">{value}</p></div><div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50', tones[tone])}><Icon size={15} /></div></div><p className={cn('mt-2 inline-flex items-center gap-1 text-[11px]', positive ? 'text-emerald-400' : 'text-slate-600')}>{positive ? <ArrowUpRight size={11} /> : null}{detail}</p></motion.div>;
}

function Panel({ title, description, className, children }: { title: string; description: string; className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-slate-900/50 bg-slate-950 p-5', className)}><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-200">{title}</h2><p className="mt-1 text-[11px] text-slate-500">{description}</p></div><PieChartIcon size={15} className="text-slate-600" /></div>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>{children}</label>;
}

function SummaryLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2"><span className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500">{color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}<span className="truncate">{label}</span></span><span className="font-mono text-[12px] font-bold text-slate-200">{value}</span></div>;
}

function RankLine({ index, label, value, percent }: { index: number; label: string; value: string; percent: number }) {
  return <div className="rounded-lg border border-slate-900 bg-slate-950/70 p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-[12px] font-semibold text-slate-300">{index}. {label}</span><span className="font-mono text-[11px] text-slate-400">{value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} /></div><p className="mt-1 text-[10px] text-slate-600">{percent}% do faturamento filtrado</p></div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-lg border border-slate-900 bg-slate-950/70 p-3 text-[11px] text-slate-500">{text}</p>;
}

function groupTrafficByAccount(traffic: TrafficSpendPoint[]) {
  const groups = traffic.reduce<Record<string, number>>((acc, item) => {
    acc[item.account] = (acc[item.account] ?? 0) + item.spend;
    return acc;
  }, {});
  return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function groupRevenueByProduct(revenue: SalesRevenuePoint[]) {
  const groups = revenue.reduce<Record<string, number>>((acc, item) => {
    acc[item.platform] = (acc[item.platform] ?? 0) + item.revenue;
    return acc;
  }, {});
  return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function mergeDailyFlow(revenue: SalesRevenuePoint[], traffic: TrafficSpendPoint[]) {
  const groups: Record<string, { name: string; receita: number; midia: number }> = {};
  revenue.forEach((item) => {
    groups[item.date] = groups[item.date] ?? { name: item.label, receita: 0, midia: 0 };
    groups[item.date].receita += item.revenue;
  });
  traffic.forEach((item) => {
    groups[item.date] = groups[item.date] ?? { name: item.label, receita: 0, midia: 0 };
    groups[item.date].midia += item.spend;
  });
  return Object.entries(groups).sort(([first], [second]) => first.localeCompare(second)).map(([, value]) => value);
}

function resolveDateRange(preset: PeriodPreset, customStart: string, customEnd: string) {
  const today = startOfDay(new Date());
  if (preset === 'custom') return { start: customStart, end: customEnd };
  if (preset === '7d') return { start: toIso(addDays(today, -6)), end: toIso(today) };
  if (preset === '30d') return { start: toIso(addDays(today, -29)), end: toIso(today) };
  if (preset === 'month') return { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, end: toIso(today) };
  return { start: '', end: '' };
}

function matchesDate(date: string, start: string, end: string) {
  return (!start || date >= start) && (!end || date <= end);
}

function describeRange(start: string, end: string) {
  if (!start && !end) return 'Sem recorte de data';
  return `${start ? formatDate(start) : 'Início'} - ${end ? formatDate(end) : 'Hoje'}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}
