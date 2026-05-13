import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '../lib/utils';

const dataArea = [
  { name: 'Jun 22', value: 1000 },
  { name: 'Jun 24', value: 2000 },
  { name: 'Jun 26', value: 1500 },
  { name: 'Jun 29', value: 2780 },
  { name: 'Jul 02', value: 1890 },
  { name: 'Jul 08', value: 2390 },
  { name: 'Jul 16', value: 3490 },
];

const dataBar = [
  { name: '1', value: 40 }, { name: '2', value: 60 }, { name: '3', value: 45 },
  { name: '4', value: 80 }, { name: '5', value: 55 }, { name: '6', value: 90 },
  { name: '7', value: 65 }, { name: '8', value: 70 },
];

const dataPie = [
  { name: 'Atingindo', value: 75 },
  { name: 'Abaixo', value: 25 },
];
const COLORS = ['#3b82f6', '#334155']; // blue and dark slate

const activeLaunches = [
  { name: 'Projeto Alpha', value: 'R$ 38.8k', change: '+2.68%', isUp: true },
  { name: 'Mentoria Vip', value: 'R$ 34.9k', change: '-0.56%', isUp: false },
  { name: 'Curso Cripto', value: 'R$ 43.0k', change: '+2.73%', isUp: true },
  { name: 'E-book Invest', value: 'R$ 39.5k', change: '+2.67%', isUp: true },
  { name: 'Mastermind', value: 'R$ 42.1k', change: '-0.68%', isUp: false },
];

export function Dashboard() {
  return (
    <div className="p-10 space-y-8 max-w-[1400px] mx-auto text-slate-300">
      
      {/* Header section of dashboard */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-100 tracking-tight">Visão Geral</h1>
          <p className="text-slate-500 text-[12px] mt-1">Acompanhe as métricas de performance e lançamentos.</p>
        </div>
        <div className="flex gap-2">
          <button className="text-[11px] font-semibold px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors">
            Filtrar: Este Mês
          </button>
          <button className="text-[11px] font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors">
            Exportar Relatório
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Cards - More minimal */}
        {[
          { label: 'Faturamento Total', value: 'R$ 936.200,00', change: '+4.9%', isUp: true },
          { label: 'Leads Ativos', value: '15.420', change: '+12.5%', isUp: true },
          { label: 'Conversão Média', value: '4.82%', change: '-0.3%', isUp: false },
          { label: 'Projetos em Curso', value: '12', change: 'Estável', isUp: true },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-slate-950 border border-slate-900/80 p-4 rounded-xl"
          >
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">{stat.label}</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h3 className="text-lg font-bold font-mono tracking-tighter text-slate-100">{stat.value}</h3>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", stat.isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                {stat.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Revenue Progress (8 spans) */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="lg:col-span-8 bg-slate-950 border border-slate-900/50 rounded-2xl p-6 h-[400px] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Performance de Vendas</h2>
              <p className="text-[11px] text-slate-500">Volume transacionado nos últimos 30 dias.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[10px] text-slate-400">Receita Realizada</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataArea}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Lançamentos Card (4 spans) */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 bg-slate-950 border border-slate-900/50 rounded-2xl p-6 h-[400px] flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-slate-200">Próximos Lançamentos</h2>
            <button className="p-1.5 hover:bg-slate-900 rounded-lg transition-colors">
              <Activity size={12} className="text-slate-500" />
            </button>
          </div>
          
          <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {activeLaunches.map((item, i) => (
              <div key={i} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                    <span className="text-[10px] font-bold">{i+1}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-300 tracking-tight">{item.name}</p>
                    <p className="text-[10px] text-slate-600">Previsto: 25 Jul</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-mono text-slate-400">{item.value}</p>
                  <p className={cn("text-[10px] font-bold", item.isUp ? "text-emerald-500" : "text-rose-500")}>
                    {item.change}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-6 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-white transition-colors">
            Gerenciar Lançamentos
          </button>
        </motion.div>
      </div>

      {/* Activities Feed - More minimal and cleaner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-950 border border-slate-900/50 rounded-2xl p-6"
        >
          <h2 className="text-sm font-semibold text-slate-200 mb-6">Atividades Recentes</h2>
          <div className="space-y-4">
            {[
              { type: 'Task', text: 'Bruno Simplicio atualizou o status de "Projeto Alpha"', time: 'há 12 min' },
              { type: 'Lead', text: 'Novo lead capturado na Landing Page "Mentoria"', time: 'há 45 min' },
              { type: 'Sale', text: 'Venda confirmada: Mastermind VIP (R$ 5.000)', time: 'há 2h' },
            ].map((activity, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[12px] text-slate-300 leading-tight">{activity.text}</p>
                  <span className="text-[10px] text-slate-600 mt-1 block">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-slate-950 border border-slate-900/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center"
        >
          <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center mb-4">
            <PieChartIcon size={18} className="text-slate-600" />
          </div>
          <p className="text-[12px] font-medium text-slate-300">Resumo Financeiro Semanal</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">Você atingiu 85% da sua meta de faturamento semanal projetada.</p>
          <div className="mt-6 w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '85%' }}
              className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
            />
          </div>
        </motion.div>
      </div>

    </div>
  );
}
