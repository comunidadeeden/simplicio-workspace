import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowUpRight, Calculator, CalendarDays, RefreshCw, Rocket, Target, TrendingUp, Wallet } from 'lucide-react';
import { type SalesRevenuePoint, type TrafficSpendPoint } from '../lib/finance';
import { defaultIntegrationSettings, loadSheetData, subscribeIntegrationSettings } from '../lib/integrations';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const inputClass = 'h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 font-mono text-[13px] text-slate-100 outline-none focus:ring-1 focus:ring-blue-600';

type LoadStatus = 'loading' | 'ready' | 'error';

export function Launches() {
  const [revenue, setRevenue] = useState<SalesRevenuePoint[]>([]);
  const [traffic, setTraffic] = useState<TrafficSpendPoint[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sheetMessage, setSheetMessage] = useState('Carregando dados do lançamento...');
  const [leads, setLeads] = useState(0);
  const [showRate, setShowRate] = useState(35);
  const [closeRate, setCloseRate] = useState(8);
  const [ticket, setTicket] = useState(0);
  const [extraSpend, setExtraSpend] = useState(0);
  const [targetCpa, setTargetCpa] = useState(180);

  useEffect(() => {
    return subscribeIntegrationSettings(
      (settings) => {
        setStatus('loading');
        loadSheetData(settings).then((result) => {
          setRevenue(result.sales);
          setTraffic(result.traffic);
          setStatus(result.errors.length ? 'error' : 'ready');
          setSheetMessage(result.errors.length ? `Planilhas não carregadas: ${result.errors.join(' | ')}` : 'Ciclo atualizado com dados reais das planilhas.');
        });
      },
      () => {
        loadSheetData(defaultIntegrationSettings).then((result) => {
          setRevenue(result.sales);
          setTraffic(result.traffic);
          setStatus(result.errors.length ? 'error' : 'ready');
          setSheetMessage(result.errors.length ? `Planilhas não carregadas: ${result.errors.join(' | ')}` : 'Ciclo atualizado com dados reais das planilhas.');
        });
      },
    );
  }, []);

  const cycle = useMemo(() => {
    const end = startOfDay(new Date());
    return { start: lastSaturday(end), end };
  }, []);
  const cycleStart = toIso(cycle.start);
  const cycleEnd = toIso(cycle.end);
  const cycleRevenue = useMemo(() => revenue.filter((item) => matchesDate(item.date, cycleStart, cycleEnd)), [cycleEnd, cycleStart, revenue]);
  const cycleTraffic = useMemo(() => traffic.filter((item) => matchesDate(item.date, cycleStart, cycleEnd)), [cycleEnd, cycleStart, traffic]);

  const currentRevenue = sum(cycleRevenue.map((item) => item.revenue));
  const currentOrders = sum(cycleRevenue.map((item) => item.orders));
  const currentSpend = sum(cycleTraffic.map((item) => item.spend));
  const currentTicket = currentRevenue / Math.max(currentOrders, 1);
  const currentRoas = currentSpend ? currentRevenue / currentSpend : 0;
  const currentCpa = currentOrders ? currentSpend / currentOrders : 0;

  useEffect(() => {
    if (!ticket && currentTicket > 0) setTicket(round(currentTicket));
  }, [currentTicket, ticket]);

  const projectedShowups = leads * (showRate / 100);
  const projectedSales = projectedShowups * (closeRate / 100);
  const projectedRevenue = projectedSales * ticket;
  const projectedSpend = currentSpend + extraSpend;
  const projectedCpa = projectedSales ? projectedSpend / projectedSales : 0;
  const projectedRoas = projectedSpend ? projectedRevenue / projectedSpend : 0;
  const breakEvenSales = ticket ? projectedSpend / ticket : 0;
  const spendRoom = Math.max(0, (projectedSales * targetCpa) - currentSpend);
  const flow = useMemo(() => mergeDailyFlow(cycleRevenue, cycleTraffic), [cycleRevenue, cycleTraffic]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Projeção de lançamento</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Lançamentos</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">Ciclo do Workshop Bússola da Cura até a oferta do Éden, com projeção recalculada conforme as métricas de conversão.</p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <StatusBanner status={status} message={sheetMessage} />
          <div className="flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-[11px] text-slate-500">
            <CalendarDays size={13} className="text-blue-400" />
            {formatDate(cycleStart)} até {formatDate(cycleEnd)}
          </div>
        </div>
      </div>

      {status === 'error' && (
        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-[12px] leading-5 text-amber-100">
          <div className="flex gap-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-semibold">As planilhas ainda não estão públicas para leitura CSV.</p><p className="mt-1 text-amber-200/80">A projeção continua funcionando com os campos manuais, mas os dados reais do ciclo ficam zerados até liberar o acesso.</p></div></div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tráfego do ciclo" value={money.format(currentSpend)} detail={`${number.format(cycleTraffic.length)} registro(s)`} icon={Rocket} tone="amber" />
        <MetricCard label="Vendas Éden" value={number.format(currentOrders)} detail={money.format(currentRevenue)} icon={TrendingUp} tone="green" positive />
        <MetricCard label="ROAS atual" value={currentRoas.toFixed(2).replace('.', ',')} detail="Faturamento / tráfego" icon={Target} tone={currentRoas >= 1 ? 'green' : 'rose'} positive={currentRoas >= 1} />
        <MetricCard label="Ticket atual" value={money.format(currentTicket)} detail="Média real do ciclo" icon={Wallet} tone="blue" positive />
        <MetricCard label="CPA atual" value={money.format(currentCpa)} detail="Custo por venda" icon={Calculator} tone={currentCpa ? 'blue' : 'rose'} positive={Boolean(currentCpa)} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Métricas editáveis" description="Altere qualquer campo para recalcular a projeção imediatamente.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField label="Leads captados" value={leads} onChange={setLeads} suffix="leads" />
            <NumberField label="Presença no workshop" value={showRate} onChange={setShowRate} suffix="%" />
            <NumberField label="Conversão para Éden" value={closeRate} onChange={setCloseRate} suffix="%" />
            <NumberField label="Ticket projetado" value={ticket} onChange={setTicket} prefix="R$" />
            <NumberField label="Verba restante" value={extraSpend} onChange={setExtraSpend} prefix="R$" />
            <NumberField label="CPA limite" value={targetCpa} onChange={setTargetCpa} prefix="R$" />
          </div>
        </Panel>

        <Panel className="xl:col-span-7" title="Projeção do lançamento" description="Resultado final estimado com base na captação e nas conversões informadas.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ProjectionTile label="Presentes estimados" value={number.format(Math.round(projectedShowups))} detail={`${showRate}% dos leads`} />
            <ProjectionTile label="Vendas projetadas" value={number.format(Math.round(projectedSales))} detail={`${closeRate}% dos presentes`} />
            <ProjectionTile label="Faturamento projetado" value={money.format(projectedRevenue)} detail={`Ticket ${money.format(ticket)}`} strong />
            <ProjectionTile label="ROAS projetado" value={projectedRoas.toFixed(2).replace('.', ',')} detail={money.format(projectedSpend)} />
            <ProjectionTile label="CPA projetado" value={money.format(projectedCpa)} detail={`${number.format(Math.ceil(breakEvenSales))} venda(s) para pagar mídia`} />
            <ProjectionTile label="Margem para escalar" value={money.format(spendRoom)} detail={`CPA alvo ${money.format(targetCpa)}`} strong={spendRoom > 0} />
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-8" title="Ritmo do ciclo" description="Faturamento e tráfego entre o último sábado e hoje.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flow}>
                <defs><linearGradient id="launchRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.16}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient><linearGradient id="launchSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.14}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="#0f172a" vertical={false} />
                <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                <Area type="monotone" dataKey="receita" stroke="#22c55e" strokeWidth={2} fill="url(#launchRevenue)" />
                <Area type="monotone" dataKey="midia" stroke="#f59e0b" strokeWidth={2} fill="url(#launchSpend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="xl:col-span-4" title="Leitura rápida" description="Como usar essa projeção no dia a dia.">
          <div className="space-y-3 text-[12px] leading-5 text-slate-500">
            <Insight title="Até onde escalar" text="Use a margem para escalar como teto de verba mantendo o CPA limite informado." />
            <Insight title="Live do sábado" text="Presença e conversão controlam o tamanho da oferta do Éden. Pequenas mudanças nesses campos mudam o resultado final." />
            <Insight title="Próximo workshop" text="Leads captados representam a semana de captação do Workshop Bússola da Cura, mesmo enquanto o sábado atual vende Éden." />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function StatusBanner({ status, message }: { status: LoadStatus; message: string }) {
  const tone = status === 'ready' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : status === 'loading' ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return <div className={cn('max-w-xl rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5', tone)}>{status === 'loading' && <RefreshCw size={12} className="mr-2 inline animate-spin" />}{message}</div>;
}

function Panel({ title, description, className, children }: { title: string; description: string; className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-slate-900/50 bg-slate-950 p-5', className)}><div className="mb-5"><h2 className="text-sm font-semibold text-slate-200">{title}</h2><p className="mt-1 text-[11px] text-slate-500">{description}</p></div>{children}</section>;
}

function MetricCard({ label, value, detail, icon: Icon, tone, positive }: { label: string; value: string; detail: string; icon: typeof Rocket; tone: 'blue' | 'green' | 'amber' | 'rose'; positive?: boolean }) {
  const tones = { blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <div className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold tracking-tighter text-slate-100">{value}</p></div><div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50', tones[tone])}><Icon size={15} /></div></div><p className={cn('mt-2 inline-flex items-center gap-1 text-[11px]', positive ? 'text-emerald-400' : 'text-slate-600')}>{positive ? <ArrowUpRight size={11} /> : null}{detail}</p></div>;
}

function NumberField({ label, value, onChange, prefix, suffix }: { label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string }) {
  return <label className="space-y-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span><div className="relative">{prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-600">{prefix}</span>}<input className={cn(inputClass, prefix ? 'pl-9' : '', suffix ? 'pr-12' : '')} type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />{suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-600">{suffix}</span>}</div></label>;
}

function ProjectionTile({ label, value, detail, strong }: { label: string; value: string; detail: string; strong?: boolean }) {
  return <div className={cn('rounded-xl border p-4', strong ? 'border-blue-500/20 bg-blue-500/[0.06]' : 'border-slate-900 bg-slate-950/70')}><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold text-slate-100">{value}</p><p className="mt-1 text-[11px] text-slate-600">{detail}</p></div>;
}

function Insight({ title, text }: { title: string; text: string }) {
  return <div className="rounded-lg border border-slate-900 bg-slate-950/70 p-3"><p className="font-semibold text-slate-300">{title}</p><p className="mt-1">{text}</p></div>;
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

function matchesDate(date: string, start: string, end: string) {
  return (!start || date >= start) && (!end || date <= end);
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

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
