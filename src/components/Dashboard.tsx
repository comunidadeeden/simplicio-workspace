import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Activity, PieChart as PieChartIcon } from 'lucide-react';
import { defaultRevenue, defaultTrafficSpend, type SalesRevenuePoint, type TrafficSpendPoint } from '../lib/finance';
import { defaultIntegrationSettings, loadSheetData, subscribeIntegrationSettings } from '../lib/integrations';
import { cn } from '../lib/utils';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#64748b'];

export function Dashboard() {
  const [revenue, setRevenue] = useState<SalesRevenuePoint[]>(defaultRevenue);
  const [traffic, setTraffic] = useState<TrafficSpendPoint[]>(defaultTrafficSpend);
  const [sheetMessage, setSheetMessage] = useState('Planilhas aguardando leitura pública.');

  useEffect(() => {
    return subscribeIntegrationSettings(
      (settings) => {
        loadSheetData(settings).then((result) => {
          setRevenue(result.sales.length ? result.sales : defaultRevenue);
          setTraffic(result.traffic.length ? result.traffic : defaultTrafficSpend);
          setSheetMessage(result.errors.length ? `Usando prévia local. ${result.errors.join(' | ')}` : 'Dados reais sincronizados das planilhas.');
        });
      },
      () => {
        loadSheetData(defaultIntegrationSettings).then((result) => {
          setRevenue(result.sales.length ? result.sales : defaultRevenue);
          setTraffic(result.traffic.length ? result.traffic : defaultTrafficSpend);
          setSheetMessage(result.errors.length ? `Usando prévia local. ${result.errors.join(' | ')}` : 'Dados reais sincronizados das planilhas.');
        });
      },
    );
  }, []);

  const totalRevenue = sum(revenue.map((item) => item.revenue));
  const totalOrders = sum(revenue.map((item) => item.orders));
  const totalTraffic = sum(traffic.map((item) => item.spend));
  const roas = totalTraffic ? totalRevenue / totalTraffic : 0;
  const averageTicket = totalRevenue / Math.max(totalOrders, 1);

  const revenueByDate = useMemo(() => groupRevenueByDate(revenue), [revenue]);
  const trafficByAccount = useMemo(() => groupTrafficByAccount(traffic), [traffic]);
  const platformData = useMemo(() => groupRevenueByPlatform(revenue), [revenue]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-10 text-slate-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-display font-bold tracking-tight text-slate-100">Visão Geral</h1>
          <p className="mt-1 text-[12px] text-slate-500">Vendas e mídia conectadas pelas planilhas da operação.</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-500">
          {sheetMessage}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Faturamento Total', value: money.format(totalRevenue), change: `${totalOrders} pedidos`, isUp: true },
          { label: 'Investimento em mídia', value: money.format(totalTraffic), change: `${traffic.length} linhas`, isUp: false },
          { label: 'ROAS', value: roas.toFixed(2).replace('.', ','), change: 'Receita / mídia', isUp: roas >= 1 },
          { label: 'Ticket médio', value: money.format(averageTicket), change: 'Por pedido', isUp: true },
        ].map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-xl border border-slate-900/80 bg-slate-950 p-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{stat.label}</p>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <h3 className="font-mono text-lg font-bold tracking-tighter text-slate-100">{stat.value}</h3>
              <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold', stat.isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300')}>
                {stat.isUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {stat.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-[400px] flex-col rounded-2xl border border-slate-900/50 bg-slate-950 p-6 lg:col-span-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Performance de vendas</h2>
              <p className="text-[11px] text-slate-500">Receita agrupada por data da planilha.</p>
            </div>
            <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-blue-500" /><span className="text-[10px] text-slate-400">Receita</span></div>
          </div>
          <div className="-ml-4 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDate}>
                <defs><linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex h-[400px] flex-col rounded-2xl border border-slate-900/50 bg-slate-950 p-6 lg:col-span-4">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Contas de anúncio</h2>
            <Activity size={13} className="text-slate-500" />
          </div>
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficByAccount}>
                <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 space-y-3">
            {trafficByAccount.slice(0, 4).map((item) => <div key={item.name}><SummaryLine label={item.name} value={money.format(item.value)} /></div>)}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-slate-900/50 bg-slate-950 p-6">
          <h2 className="mb-6 text-sm font-semibold text-slate-200">Vendas recentes</h2>
          <div className="space-y-4">
            {revenue.slice(-5).reverse().map((item, index) => (
              <div key={`${item.date}-${index}`} className="flex items-start gap-4">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500/50" />
                <div className="flex-1">
                  <p className="text-[12px] leading-tight text-slate-300">{item.platform} · {money.format(item.revenue)}</p>
                  <span className="mt-1 block text-[10px] text-slate-600">{item.orders} pedido(s) em {item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center rounded-2xl border border-slate-900/50 bg-slate-950 p-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-800"><PieChartIcon size={18} className="text-slate-600" /></div>
          <p className="text-[12px] font-medium text-slate-300">Mix de faturamento</p>
          <p className="mt-1 max-w-[260px] text-[11px] text-slate-500">Distribuição por produto/plataforma encontrada na planilha de vendas.</p>
          <div className="mt-6 h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformData} innerRadius={46} outerRadius={72} dataKey="value" paddingAngle={3}>{platformData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2"><span className="truncate text-[11px] text-slate-500">{label}</span><span className="font-mono text-[12px] font-bold text-slate-200">{value}</span></div>;
}

function groupRevenueByDate(revenue: SalesRevenuePoint[]) {
  const groups = revenue.reduce<Record<string, { name: string; value: number }>>((acc, item) => {
    acc[item.date] = acc[item.date] ?? { name: item.label, value: 0 };
    acc[item.date].value += item.revenue;
    return acc;
  }, {});
  return Object.entries(groups).sort(([first], [second]) => first.localeCompare(second)).map(([, value]) => value);
}

function groupTrafficByAccount(traffic: TrafficSpendPoint[]) {
  const groups = traffic.reduce<Record<string, number>>((acc, item) => {
    acc[item.account] = (acc[item.account] ?? 0) + item.spend;
    return acc;
  }, {});
  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

function groupRevenueByPlatform(revenue: SalesRevenuePoint[]) {
  const groups = revenue.reduce<Record<string, number>>((acc, item) => {
    acc[item.platform] = (acc[item.platform] ?? 0) + item.revenue;
    return acc;
  }, {});
  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
