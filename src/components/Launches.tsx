import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowUpRight, Calculator, CalendarDays, Plus, RefreshCw, Rocket, Signal, Target, TrendingUp, Wallet } from 'lucide-react';
import { type SalesRevenuePoint, type TrafficSpendPoint } from '../lib/finance';
import { defaultIntegrationSettings, loadSheetData, subscribeIntegrationSettings } from '../lib/integrations';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const inputClass = 'h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 font-mono text-[13px] text-slate-100 outline-none focus:ring-1 focus:ring-red-600';
const compactInputClass = 'h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 font-mono text-[12px] text-slate-100 outline-none focus:ring-1 focus:ring-red-600';

type LoadStatus = 'loading' | 'ready' | 'error';

export function Launches() {
  const [revenue, setRevenue] = useState<SalesRevenuePoint[]>([]);
  const [traffic, setTraffic] = useState<TrafficSpendPoint[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [sheetMessage, setSheetMessage] = useState('Carregando dados do lançamento...');

  const [targetRevenue, setTargetRevenue] = useState(31000);
  const [totalInvestment, setTotalInvestment] = useState(50000);
  const [mainTicket, setMainTicket] = useState(697);
  const [mainConversion, setMainConversion] = useState(10);
  const [prepStart, setPrepStart] = useState('2026-05-02');
  const [salesStart, setSalesStart] = useState('2026-05-02');
  const [eventDate, setEventDate] = useState('2026-05-09');
  const [cartClose, setCartClose] = useState('2026-05-10');

  const [trafficPct, setTrafficPct] = useState(95);
  const [apiPct, setApiPct] = useState(5);
  const [smsPct, setSmsPct] = useState(0);
  const [salesTrafficPct, setSalesTrafficPct] = useState(100);
  const [distributionPct, setDistributionPct] = useState(0);
  const [remarketingPct, setRemarketingPct] = useState(0);
  const [reminderPct, setReminderPct] = useState(0);
  const [infoPct, setInfoPct] = useState(0);

  const [lotPrice, setLotPrice] = useState(31);
  const [lotQuantity, setLotQuantity] = useState(1000);
  const [trafficChannelPct, setTrafficChannelPct] = useState(100);
  const [contentChannelPct, setContentChannelPct] = useState(0);
  const [baseChannelPct, setBaseChannelPct] = useState(0);

  const [cpm, setCpm] = useState(53);
  const [ctr, setCtr] = useState(3.6);
  const [pageConversion, setPageConversion] = useState(75);

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
  const currentRoas = currentSpend ? currentRevenue / currentSpend : 0;
  const currentCpa = currentOrders ? currentSpend / currentOrders : 0;

  const lotRevenue = lotPrice * lotQuantity;
  const totalTickets = lotQuantity;
  const averageLotTicket = totalTickets ? lotRevenue / totalTickets : 0;
  const mainSales = Math.round(totalTickets * (mainConversion / 100));
  const projectedMainRevenue = mainSales * mainTicket;
  const targetRoas = totalInvestment ? targetRevenue / totalInvestment : 0;
  const trafficBudget = totalInvestment * (trafficPct / 100);
  const apiBudget = totalInvestment * (apiPct / 100);
  const smsBudget = totalInvestment * (smsPct / 100);
  const budgetSum = trafficPct + apiPct + smsPct;
  const trafficSplitSum = salesTrafficPct + distributionPct + remarketingPct + reminderPct + infoPct;
  const salesBudget = trafficBudget * (salesTrafficPct / 100);
  const distributionBudget = trafficBudget * (distributionPct / 100);
  const remarketingBudget = trafficBudget * (remarketingPct / 100);
  const reminderBudget = trafficBudget * (reminderPct / 100);
  const infoBudget = trafficBudget * (infoPct / 100);
  const trafficTickets = Math.round(totalTickets * (trafficChannelPct / 100));
  const contentTickets = Math.round(totalTickets * (contentChannelPct / 100));
  const baseTickets = Math.round(totalTickets * (baseChannelPct / 100));
  const channelSum = trafficChannelPct + contentChannelPct + baseChannelPct;
  const plannedCacTraffic = trafficTickets ? salesBudget / trafficTickets : 0;
  const plannedCacGlobal = totalTickets ? trafficBudget / totalTickets : 0;
  const salesDays = Math.max(1, daysBetween(salesStart, cartClose));
  const salesPerDay = Math.ceil(totalTickets / salesDays);
  const cpc = ctr ? cpm / (1000 * (ctr / 100)) : 0;
  const costPerPageView = pageConversion ? cpc / (pageConversion / 100) : 0;
  const simulatedCac = (pageConversion && mainConversion) ? cpc / (pageConversion / 100) / (mainConversion / 100) : 0;

  const applyRealCycleToSimulation = () => {
    const averageTicket = currentOrders ? currentRevenue / currentOrders : 0;
    if (currentSpend > 0) setTotalInvestment(round(currentSpend));
    if (currentRevenue > 0) setTargetRevenue(round(currentRevenue));
    if (currentOrders > 0) setLotQuantity(Math.round(currentOrders));
    if (averageTicket > 0) setLotPrice(round(averageTicket));
    setPrepStart(cycleStart);
    setSalesStart(cycleStart);
    setEventDate(cycleEnd);
    setCartClose(cycleEnd);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-400">Planejamento</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Lançamentos</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">Configure a estrutura financeira, orçamento, lotes e simulação de CAC do lançamento.</p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <StatusBanner status={status} message={sheetMessage} />
          <div className="flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-[11px] text-slate-500">
            <CalendarDays size={13} className="text-red-400" />
            Dados reais: {formatDate(cycleStart)} até {formatDate(cycleEnd)}
          </div>
        </div>
      </div>

      {status === 'error' && (
        <section className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-[12px] leading-5 text-amber-100">
          <div className="flex gap-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-semibold">As planilhas ainda não estão públicas para leitura CSV.</p><p className="mt-1 text-amber-200/80">O planejamento continua funcionando, mas os cards de dados reais ficam zerados até liberar o acesso.</p></div></div>
        </section>
      )}

      <Panel title="Dados reais do ciclo" description="Leitura do último sábado até hoje usando as planilhas conectadas." icon={<Signal size={15} />}>
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-900 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[12px] font-semibold text-slate-200">Usar o ciclo real como base da simulação</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Preenche investimento, faturamento, lotes e datas com os dados já importados. Depois é só mexer nos campos para testar melhorias.</p>
          </div>
          <button
            type="button"
            onClick={applyRealCycleToSimulation}
            disabled={!currentSpend && !currentRevenue && !currentOrders}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-[11px] font-semibold text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40 disabled:text-slate-600"
          >
            Puxar dados reais
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Tráfego" value={money.format(currentSpend)} detail={`${number.format(cycleTraffic.length)} registro(s)`} tone="amber" />
          <MetricCard label="Vendas" value={number.format(currentOrders)} detail={money.format(currentRevenue)} tone="green" positive />
          <MetricCard label="ROAS" value={`${currentRoas.toFixed(2).replace('.', ',')}x`} detail="Real do ciclo" tone={currentRoas >= 1 ? 'green' : 'rose'} positive={currentRoas >= 1} />
          <MetricCard label="CPA" value={money.format(currentCpa)} detail="Real do ciclo" tone={currentCpa ? 'blue' : 'rose'} positive={Boolean(currentCpa)} />
          <MetricCard label="Diferença" value={money.format(targetRevenue - currentRevenue)} detail="Até o alvo" tone="blue" />
        </div>
      </Panel>


      <Panel title="Configuração do lançamento" description="Base financeira e datas principais da campanha." icon={<Rocket size={15} />} action="Referência">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField label="Faturamento alvo" value={targetRevenue} onChange={setTargetRevenue} prefix="R$" />
          <NumberField label="Investimento total" value={totalInvestment} onChange={setTotalInvestment} prefix="R$" />
          <NumberField label="Ticket produto principal" value={mainTicket} onChange={setMainTicket} prefix="R$" />
          <NumberField label="Conversão produto" value={mainConversion} onChange={setMainConversion} suffix="%" />
          <DateField label="Início preparação" value={prepStart} onChange={setPrepStart} />
          <DateField label="Início vendas" value={salesStart} onChange={setSalesStart} />
          <DateField label="Data do evento" value={eventDate} onChange={setEventDate} />
          <DateField label="Fechamento carrinho" value={cartClose} onChange={setCartClose} />
        </div>
        <p className="mt-4 text-[11px] text-slate-600"><CalendarDays size={12} className="mr-1 inline" />Datas editáveis para simular a cadência do lançamento.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-900 pt-5 md:grid-cols-3">
          <ResultCard label="ROAS alvo" value={`${targetRoas.toFixed(1).replace('.', ',')}x`} />
          <ResultCard label="Total ingressos" value={number.format(totalTickets)} />
          <ResultCard label="Vendas produto principal" value={number.format(mainSales)} />
        </div>
      </Panel>

      <Panel title="Distribuição de orçamento" description="Defina para onde vai o investimento e como o tráfego será subdividido." icon={<Target size={15} />}>
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <BudgetGroup title="Investimento total" sum={budgetSum} rows={[
            { label: 'Tráfego', value: trafficPct, setValue: setTrafficPct, amount: trafficBudget },
            { label: 'API', value: apiPct, setValue: setApiPct, amount: apiBudget },
            { label: 'SMS/Ligação', value: smsPct, setValue: setSmsPct, amount: smsBudget },
          ]} />
          <BudgetGroup title={`Subdivisão do tráfego (${money.format(trafficBudget)})`} sum={trafficSplitSum} rows={[
            { label: 'Vendas', value: salesTrafficPct, setValue: setSalesTrafficPct, amount: salesBudget },
            { label: 'Distribuição', value: distributionPct, setValue: setDistributionPct, amount: distributionBudget },
            { label: 'Remarketing', value: remarketingPct, setValue: setRemarketingPct, amount: remarketingBudget },
            { label: 'Lembrete', value: reminderPct, setValue: setReminderPct, amount: reminderBudget },
            { label: 'Informações', value: infoPct, setValue: setInfoPct, amount: infoBudget },
          ]} />
        </div>
      </Panel>

      <Panel title="Lotes de preço" description="Simule os ingressos do workshop e o faturamento inicial." icon={<Wallet size={15} />} action="Adicionar lote">
        <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] gap-3 border-b border-slate-900 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          <span>Lote</span><span>Valor (R$)</span><span>Qtd</span><span>% do total</span><span>Faturamento</span>
        </div>
        <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] items-center gap-3 py-3 text-[12px] text-slate-400">
          <span className="font-mono text-slate-500">#1</span>
          <input className={compactInputClass} type="number" min="0" value={lotPrice} onChange={(event) => setLotPrice(Number(event.target.value) || 0)} />
          <input className={compactInputClass} type="number" min="0" value={lotQuantity} onChange={(event) => setLotQuantity(Number(event.target.value) || 0)} />
          <span className="font-mono">100,0%</span>
          <span className="font-mono font-semibold text-slate-100">{money.format(lotRevenue)}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-900 pt-4 md:grid-cols-3">
          <ResultCard label="Total ingressos" value={number.format(totalTickets)} />
          <ResultCard label="Faturamento lotes" value={money.format(lotRevenue)} />
          <ResultCard label="Ticket médio" value={money.format(averageLotTicket)} />
        </div>
      </Panel>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Canais de venda + cadência" description="Distribuição de vendas esperadas por origem." icon={<TrendingUp size={15} />} action="Canal">
          <div className="space-y-3">
            <ChannelRow label="Tráfego" value={trafficChannelPct} onChange={setTrafficChannelPct} amount={trafficTickets} />
            <ChannelRow label="Conteúdo" value={contentChannelPct} onChange={setContentChannelPct} amount={contentTickets} />
            <ChannelRow label="Base" value={baseChannelPct} onChange={setBaseChannelPct} amount={baseTickets} />
          </div>
          <div className="mt-5 rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-500">Soma dos canais: <span className={cn('font-mono font-bold', channelSum === 100 ? 'text-emerald-400' : 'text-amber-300')}>{channelSum.toFixed(1)}%</span></div>
        </Panel>

        <Panel className="xl:col-span-7" title="CAC do planejamento" description="Quanto cada venda custa com a distribuição planejada." icon={<Calculator size={15} />}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BigResult label="CAC tráfego" value={money.format(plannedCacTraffic)} detail={`${money.format(salesBudget)} / ${number.format(trafficTickets)} venda(s)`} />
            <BigResult label="CAC global" value={money.format(plannedCacGlobal)} detail={`${money.format(trafficBudget)} / ${number.format(totalTickets)} venda(s)`} />
            <ResultCard label="Dias de venda" value={number.format(salesDays)} />
            <ResultCard label="Vendas/dia" value={number.format(salesPerDay)} />
          </div>
        </Panel>
      </section>

      <Panel title="Simulação de CAC" description="Parâmetros de funil para entender o custo provável antes de escalar." icon={<ArrowUpRight size={15} />} action="Referência">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-5">
            <SliderField label="CPM" value={cpm} onChange={setCpm} min={5} max={200} prefix="R$" />
            <SliderField label="CTR" value={ctr} onChange={setCtr} min={0.1} max={8} suffix="%" step={0.1} />
            <SliderField label="Conversão página" value={pageConversion} onChange={setPageConversion} min={1} max={100} suffix="%" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BigResult className="md:col-span-2" label="CAC simulado" value={money.format(simulatedCac)} detail="CPC / conversão página / conversão produto" />
            <ResultCard label="CPC" value={money.format(cpc)} />
            <ResultCard label="Custo/PV" value={money.format(costPerPageView)} />
            <ResultCard label="Vendas principais" value={number.format(mainSales)} />
            <ResultCard label="Receita produto" value={money.format(projectedMainRevenue)} />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function StatusBanner({ status, message }: { status: LoadStatus; message: string }) {
  const tone = status === 'ready' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : status === 'loading' ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  return <div className={cn('max-w-xl rounded-lg border px-3 py-2 text-[11px] font-semibold leading-5', tone)}>{status === 'loading' && <RefreshCw size={12} className="mr-2 inline animate-spin" />}{message}</div>;
}

function Panel({ title, description, icon, action, className, children }: { title: string; description: string; icon: ReactNode; action?: string; className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-slate-900/60 bg-slate-950 p-5', className)}><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="text-red-400">{icon}</span>{title}</h2><p className="mt-1 text-[11px] text-slate-500">{description}</p></div>{action && <button className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300"><Plus size={12} />{action}</button>}</div>{children}</section>;
}

function NumberField({ label, value, onChange, prefix, suffix }: { label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string }) {
  return <label className="space-y-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span><div className="relative">{prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-600">{prefix}</span>}<input className={cn(inputClass, prefix ? 'pl-9' : '', suffix ? 'pr-12' : '')} type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} />{suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-600">{suffix}</span>}</div></label>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span><input className={inputClass} type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-900 bg-slate-900/60 p-4 text-center"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 font-mono text-lg font-bold text-slate-100">{value}</p></div>;
}

function BigResult({ label, value, detail, className }: { label: string; value: string; detail: string; className?: string }) {
  return <div className={cn('rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-center', className)}><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 font-mono text-2xl font-bold text-slate-100">{value}</p><p className="mt-1 text-[11px] text-slate-600">{detail}</p></div>;
}

function MetricCard({ label, value, detail, tone, positive }: { label: string; value: string; detail: string; tone: 'blue' | 'green' | 'amber' | 'rose'; positive?: boolean }) {
  const tones = { blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <div className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className={cn('mt-2 font-mono text-lg font-bold tracking-tighter', tones[tone])}>{value}</p><p className={cn('mt-2 inline-flex items-center gap-1 text-[11px]', positive ? 'text-emerald-400' : 'text-slate-600')}>{positive ? <ArrowUpRight size={11} /> : null}{detail}</p></div>;
}

function BudgetGroup({ title, sum, rows }: { title: string; sum: number; rows: { label: string; value: number; setValue: (value: number) => void; amount: number }[] }) {
  return <div><div className="mb-4 flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{title}</p><span className={cn('rounded-lg px-2 py-1 font-mono text-[11px] font-bold', sum === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300')}>Soma: {sum.toFixed(1)}%</span></div><div className="space-y-3">{rows.map((row) => <div key={row.label} className="grid grid-cols-[90px_76px_1fr] items-center gap-3 text-[12px]"><span className="text-slate-400">{row.label}</span><div className="relative"><input className={cn(compactInputClass, 'w-full pr-7')} type="number" min="0" value={row.value} onChange={(event) => row.setValue(Number(event.target.value) || 0)} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">%</span></div><span className="font-mono text-slate-500">{money.format(row.amount)}</span></div>)}</div></div>;
}

function ChannelRow({ label, value, onChange, amount }: { label: string; value: number; onChange: (value: number) => void; amount: number }) {
  return <div className="grid grid-cols-[80px_80px_1fr] items-center gap-3 text-[12px]"><span className="text-slate-400">{label}</span><div className="relative"><input className={cn(compactInputClass, 'w-full pr-7')} type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">%</span></div><span className="font-mono text-slate-500">{number.format(amount)} vendas</span></div>;
}

function SliderField({ label, value, onChange, min, max, step = 1, prefix, suffix }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; prefix?: string; suffix?: string }) {
  return <label className="block"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span><span className="font-mono text-[12px] font-bold text-slate-100">{prefix}{value}{suffix}</span></div><input className="w-full accent-red-600" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /><div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600"><span>{min}</span><span>{max}</span></div></label>;
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

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 1;
  return Math.max(1, Math.ceil((endTime - startTime) / 86400000) + 1);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
