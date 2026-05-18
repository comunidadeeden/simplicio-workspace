import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Filter, PieChart as PieChartIcon, RefreshCw, Target, TrendingUp, Wallet } from 'lucide-react';
import { type SalesRevenuePoint, type TrafficSpendPoint } from '../lib/finance';
import { defaultIntegrationSettings, loadSheetData, subscribeIntegrationSettings } from '../lib/integrations';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#38bdf8', '#a78bfa', '#64748b'];
const inputClass = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40';
const defaultDateRange = getDefaultDateRange();

type LoadStatus = 'loading' | 'ready' | 'error';

export function Dashboard() {
  const [revenue, setRevenue] = useState<SalesRevenuePoint[]>([]);
  const [traffic, setTraffic] = useState<TrafficSpendPoint[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sheetMessage, setSheetMessage] = useState('Carregando planilhas configuradas...');
  const [productFilters, setProductFilters] = useState<string[]>(['Workshop', 'Éden']);
  const [accountFilter, setAccountFilter] = useState('Todas');
  const [customStart, setCustomStart] = useState(defaultDateRange.start);
  const [customEnd, setCustomEnd] = useState(defaultDateRange.end);
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

  const productOptions = useMemo(() => ['Workshop', 'Éden', ...unique(revenue.map((item) => item.platform)).filter((item) => !isWorkshopProduct(item) && !isEdenProduct(item))], [revenue]);
  const accountOptions = useMemo(() => ['Todas', ...unique(traffic.map((item) => item.account))], [traffic]);
  const dateRange = useMemo(() => ({ start: customStart, end: customEnd }), [customEnd, customStart]);

  const filteredRevenue = useMemo(() => revenue.filter((item) => {
    const matchesProduct = productFilters.length === 0 || productFilters.some((filter) => matchesProductFilter(item.platform, filter));
    return matchesProduct && matchesDate(item.date, dateRange.start, dateRange.end);
  }), [dateRange.end, dateRange.start, productFilters, revenue]);

  const filteredTraffic = useMemo(() => traffic.filter((item) => {
    const matchesAccount = accountFilter === 'Todas' || item.account === accountFilter;
    return matchesAccount && matchesDate(item.date, dateRange.start, dateRange.end);
  }), [accountFilter, dateRange.end, dateRange.start, traffic]);

  const totalRevenue = sum(filteredRevenue.map((item) => item.revenue));
  const totalOrders = sum(filteredRevenue.map((item) => item.orders));
  const totalTraffic = sum(filteredTraffic.map((item) => item.spend));
  const roas = totalTraffic ? totalRevenue / totalTraffic : 0;
  const averageTicket = totalRevenue / Math.max(totalOrders, 1);
  const cpa = totalOrders ? totalTraffic / totalOrders : 0;

  const funnelData = useMemo(() => buildFunnel(filteredTraffic, filteredRevenue), [filteredRevenue, filteredTraffic]);
  const productData = useMemo(() => groupRevenueByProduct(filteredRevenue), [filteredRevenue]);
  const dailyFlow = useMemo(() => mergeDailyFlow(filteredRevenue, filteredTraffic), [filteredRevenue, filteredTraffic]);

  const toggleProductFilter = (filter: string) => {
    setProductFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  };

  const resetSegmentFilters = () => {
    setProductFilters([]);
    setAccountFilter('Todas');
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,1fr)_auto]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Comando da operação</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">Analise faturamento, mídia, ROAS e mix de produtos com filtros de gestão.</p>
        </div>
        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex justify-start xl:justify-end">
            <StatusBanner status={status} message={sheetMessage} />
          </div>
          <div className="grid gap-2 lg:grid-cols-[220px_auto_40px] xl:justify-end">
            <ProductDropdown options={productOptions} selected={productFilters} onToggle={toggleProductFilter} onClear={() => setProductFilters([])} />
            <DateRangeControl start={customStart} end={customEnd} onStart={setCustomStart} onEnd={setCustomEnd} onReset={() => {
              const range = getDefaultDateRange();
              setCustomStart(range.start);
              setCustomEnd(range.end);
            }} />

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
          <div className="flex items-center gap-2 text-[11px] text-slate-600 xl:justify-end">
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
            <Field label="Conta de anúncio"><select className={inputClass} value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>{accountOptions.map((item) => <option key={item}>{item}</option>)}</select></Field>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Faturamento" value={money.format(totalRevenue)} icon={TrendingUp} tone="blue" />
        <MetricCard label="Tráfego" value={money.format(totalTraffic)} icon={ArrowDownRight} tone="amber" />
        <MetricCard label="ROAS" value={roas.toFixed(2).replace('.', ',')} icon={Target} tone={roas >= 2 ? 'green' : roas >= 1 ? 'amber' : 'rose'} />
        <MetricCard label="Ticket médio" value={money.format(averageTicket)} icon={Wallet} tone="green" />
        <MetricCard label="CPA" value={money.format(cpa)} icon={ArrowUpRight} tone={cpa ? 'blue' : 'rose'} />
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
                <YAxis yAxisId="money" hide />
                <YAxis yAxisId="cpa" hide orientation="right" />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value, name) => [money.format(Number(value)), name === 'cpa' ? 'Custo por compra' : name === 'receita' ? 'Receita' : 'Mídia']} />
                <Area yAxisId="money" type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} fill="url(#dashRevenue)" />
                <Area yAxisId="money" type="monotone" dataKey="midia" stroke="#f59e0b" strokeWidth={2} fill="url(#dashSpend)" />
                <Line yAxisId="cpa" type="monotone" dataKey="cpa" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#38bdf8' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="Funil do período" description="Etapas principais do tráfego até as compras no período.">
          <FunnelChart steps={funnelData} />
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-7" title="Faturamento por produto" description="Participação visual do faturamento no período filtrado.">
          <div className="grid gap-5 lg:grid-cols-[minmax(240px,1fr)_260px] lg:items-center">
            <div className="relative h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={productData} innerRadius={72} outerRadius={116} dataKey="value" paddingAngle={4} stroke="#020617" strokeWidth={4}>
                    {productData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Total</span>
                <span className="mt-1 font-mono text-lg font-bold text-slate-100">{money.format(totalRevenue)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {productData.length ? productData.slice(0, 6).map((item, index) => <div key={item.name}><ProductLegend item={item} total={totalRevenue} color={COLORS[index % COLORS.length]} /></div>) : <EmptyText text="Sem produtos no período." />}
            </div>
          </div>
        </Panel>
        <Panel className="xl:col-span-5" title="Vendas recentes" description="Últimos registros encontrados na planilha.">
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



function DateRangeControl({
  start,
  end,
  onStart,
  onEnd,
  onReset,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-1.5">
      <CalendarDays size={14} className="ml-1 text-blue-400" />
      <input className="h-7 rounded-md border border-slate-800 bg-slate-950 px-2 text-[11px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600" type="date" value={start} onChange={(event) => onStart(event.target.value)} aria-label="Início do período" />
      <span className="text-[10px] text-slate-600">até</span>
      <input className="h-7 rounded-md border border-slate-800 bg-slate-950 px-2 text-[11px] text-slate-300 outline-none focus:ring-1 focus:ring-blue-600" type="date" value={end} onChange={(event) => onEnd(event.target.value)} aria-label="Fim do período" />
      <button type="button" onClick={onReset} className="rounded-md px-2 py-1 text-[10px] font-semibold text-blue-300 transition-colors hover:bg-blue-500/10">
        Último sábado até hoje
      </button>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof TrendingUp; tone: 'blue' | 'green' | 'amber' | 'rose' }) {
  const tones = { blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold tracking-tighter text-slate-100">{value}</p></div><div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50', tones[tone])}><Icon size={15} /></div></div></motion.div>;
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

function ProductLegend({ item, total, color }: { item: { name: string; value: number }; total: number; color: string }) {
  const percent = total ? Math.round((item.value / total) * 100) : 0;
  return <div className="rounded-lg border border-slate-900 bg-slate-950/70 p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-slate-300"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="truncate">{item.name}</span></span><span className="font-mono text-[11px] text-slate-400">{percent}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-900"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} /></div><p className="mt-1 font-mono text-[11px] text-slate-500">{money.format(item.value)}</p></div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-lg border border-slate-900 bg-slate-950/70 p-3 text-[11px] text-slate-500">{text}</p>;
}

function ProductDropdown({ options, selected, onToggle, onClear }: { options: string[]; selected: string[]; onToggle: (value: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const label = selected.length === 0 ? 'Todos os produtos' : selected.length === 1 ? selected[0] : `${selected.length} produtos`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 text-left text-[12px] font-semibold text-slate-300 transition-colors hover:border-slate-700"
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className="text-[10px] text-slate-600">Produto</span>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-30 w-64 rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl shadow-black/30">
          <button type="button" onClick={onClear} className={cn('mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors', selected.length === 0 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')}>
            Todos os produtos
            {selected.length === 0 && <span className="font-mono text-[10px]">ativo</span>}
          </button>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {options.map((item) => {
              const active = selected.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onToggle(item)}
                  className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors', active ? 'bg-blue-500/15 text-blue-200' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100')}
                >
                  <span className="truncate">{item}</span>
                  <span className={cn('h-2 w-2 rounded-full', active ? 'bg-blue-400' : 'bg-slate-800')} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type FunnelStepData = {
  label: string;
  value: number;
  conversion: number | null;
  costLabel: string;
  costValue: number | null;
};

function FunnelChart({ steps }: { steps: FunnelStepData[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-blue-500/10 bg-slate-950/80 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(190px,1fr)_132px]">
        <div className="relative space-y-2">
          {steps.map((step, index) => (
            <div key={step.label} className="relative flex justify-center">
              {index > 0 && <ConversionBadge value={step.conversion} />}
              <div
                className="relative z-10 flex min-h-[48px] flex-col items-center justify-center border border-cyan-300/25 bg-gradient-to-b from-blue-400 to-cyan-500 px-3 py-1.5 text-center text-slate-950 shadow-[0_0_22px_rgba(56,189,248,0.16)]"
                style={{
                  width: `${Math.max(46, 88 - index * 7)}%`,
                  clipPath: 'polygon(5% 0, 95% 0, 88% 100%, 12% 100%)',
                }}
              >
                <span className="text-[9px] font-bold uppercase leading-none tracking-wide text-slate-800">{step.label}</span>
                <span className="mt-1 font-mono text-xl font-bold leading-none tracking-tighter">{number.format(Math.round(step.value))}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-2">
          {steps.map((step) => (
            <div key={step.label} className="min-h-[48px] border-l border-slate-800 pl-3">
              <div className="flex h-full flex-col justify-center">
                <span className="text-[10px] font-semibold leading-tight text-slate-500">{step.costLabel}</span>
                <span className="mt-1 font-mono text-[15px] font-bold leading-none text-slate-100">{step.costValue === null ? 'N/A' : money.format(step.costValue)}</span>
                {step.conversion !== null && <span className={cn('mt-1 text-[10px] font-semibold', step.conversion > 0 ? 'text-emerald-400' : 'text-slate-600')}>{formatPercent(step.conversion)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConversionBadge({ value }: { value: number | null }) {
  return (
    <div className="absolute right-1 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-1 md:flex">
      <span className="h-px w-5 bg-blue-500/40" />
      <span className="rounded-lg border border-blue-400/25 bg-slate-950/95 px-2 py-1 font-mono text-[10px] font-bold text-blue-100 shadow-[0_0_16px_rgba(59,130,246,0.12)]">{value === null ? '0,00%' : formatPercent(value)}</span>
    </div>
  );
}

function buildFunnel(traffic: TrafficSpendPoint[], revenue: SalesRevenuePoint[]): FunnelStepData[] {
  const spend = sum(traffic.map((item) => item.spend));
  const impressions = sum(traffic.map((item) => item.impressions));
  const clicks = sum(traffic.map((item) => item.clicks));
  const pageViews = sum(traffic.map((item) => readTrafficNumber(item, ['landing page views', 'visualizacoes de pagina', 'visualizações de página', 'visualizacao de pagina', 'page views'])));
  const checkouts = sum(traffic.map((item) => readTrafficNumber(item, ['initiate checkout', 'checkouts iniciados', 'iniciar finalizacao', 'iniciar finalização'])));
  const workshopPurchases = sum(revenue.filter((item) => isWorkshopProduct(item.platform)).map((item) => item.orders));
  const edenPurchases = sum(revenue.filter((item) => isEdenProduct(item.platform)).map((item) => item.orders));

  const rawSteps = [
    { label: 'Impressões', value: impressions, costLabel: 'CPM', costValue: impressions ? (spend / impressions) * 1000 : null },
    { label: 'Cliques no link', value: clicks, costLabel: 'Custo/clique', costValue: clicks ? spend / clicks : null },
    { label: 'Page view', value: pageViews, costLabel: 'Custo/page view', costValue: pageViews ? spend / pageViews : null },
    { label: 'Iniciou checkout', value: checkouts, costLabel: 'Custo/checkout', costValue: checkouts ? spend / checkouts : null },
    { label: 'Compras workshop', value: workshopPurchases, costLabel: 'Custo/compra', costValue: workshopPurchases ? spend / workshopPurchases : null },
    { label: 'Compras Éden', value: edenPurchases, costLabel: 'Custo/Éden', costValue: edenPurchases ? spend / edenPurchases : null },
  ];

  return rawSteps.map((step, index) => ({
    ...step,
    conversion: index === 0 ? null : rawSteps[index - 1].value ? step.value / rawSteps[index - 1].value : 0,
  }));
}

function readTrafficNumber(item: TrafficSpendPoint, aliases: string[]) {
  const key = aliases.map(normalizeKey).find((alias) => item.raw[alias] !== undefined);
  return key ? parseFlexibleNumber(item.raw[key]) : 0;
}

function groupRevenueByProduct(revenue: SalesRevenuePoint[]) {
  const groups = revenue.reduce<Record<string, number>>((acc, item) => {
    acc[item.platform] = (acc[item.platform] ?? 0) + item.revenue;
    return acc;
  }, {});
  return Object.entries(groups).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function mergeDailyFlow(revenue: SalesRevenuePoint[], traffic: TrafficSpendPoint[]) {
  const groups: Record<string, { name: string; receita: number; midia: number; pedidos: number }> = {};
  revenue.forEach((item) => {
    groups[item.date] = groups[item.date] ?? { name: item.label, receita: 0, midia: 0, pedidos: 0 };
    groups[item.date].receita += item.revenue;
    groups[item.date].pedidos += item.orders;
  });
  traffic.forEach((item) => {
    groups[item.date] = groups[item.date] ?? { name: item.label, receita: 0, midia: 0, pedidos: 0 };
    groups[item.date].midia += item.spend;
  });
  return Object.entries(groups)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, value]) => ({ ...value, cpa: value.pedidos ? value.midia / value.pedidos : 0 }));
}

function matchesDate(date: string, start: string, end: string) {
  return (!start || date >= start) && (!end || date <= end);
}

function describeRange(start: string, end: string) {
  if (!start && !end) return 'Sem recorte de data';
  const currentRange = getDefaultDateRange();
  const label = start === currentRange.start && end === currentRange.end ? 'Período atual: ' : '';
  return `${label}${start ? formatDate(start) : 'Início'} - ${end ? formatDate(end) : 'Hoje'}`;
}

function getDefaultDateRange() {
  const end = startOfDay(new Date());
  return { start: toIso(lastSaturday(end)), end: toIso(end) };
}

function lastSaturday(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = (day + 1) % 7;
  next.setDate(next.getDate() - diff);
  return startOfDay(next);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}



function matchesProductFilter(product: string, filter: string) {
  if (filter === 'Workshop') return isWorkshopProduct(product);
  if (filter === 'Éden') return isEdenProduct(product);
  return product === filter;
}

function isWorkshopProduct(product: string) {
  const value = normalizeKey(product);
  return /workshop|bussola|ingresso|live|aula/.test(value);
}


function isEdenProduct(product: string) {
  const value = normalizeKey(product);
  return /eden|comunidade/.test(value);
}

function normalizeKey(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseFlexibleNumber(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const normalized = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
    return Number(normalized) || 0;
  }
  if (lastComma >= 0) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(cleaned) || 0;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2).replace('.', ',')}%`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}
