import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Plus,
  ReceiptText,
  Repeat2,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  createExpense,
  defaultExpenses,
  defaultRevenue,
  emptyExpenseDraft,
  expenseCategories,
  expenseKinds,
  expenseStatuses,
  removeExpense,
  subscribeExpenses,
  updateExpense,
  type ExpenseDraft,
  type ExpenseKind,
  type ExpenseStatus,
  TRAFFIC_TAX_RATE,
  type FinanceExpense,
} from '../lib/finance';
import { defaultIntegrationSettings, loadSheetData, subscribeIntegrationSettings } from '../lib/integrations';
import { cn } from '../lib/utils';

type SyncStatus = 'connecting' | 'online' | 'local';
type FinanceView = 'overview' | 'expenses' | 'recurring';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#64748b'];
const inputClass = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';

export function Finance() {
  const [expenses, setExpenses] = useState<FinanceExpense[]>(defaultExpenses);
  const [revenue, setRevenue] = useState(defaultRevenue);
  const [trafficExpenses, setTrafficExpenses] = useState<FinanceExpense[]>([]);
  const [integrationSettings, setIntegrationSettings] = useState(defaultIntegrationSettings);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetMessage, setSheetMessage] = useState('Planilhas aguardando leitura.');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncMessage, setSyncMessage] = useState('Conectando ao Firebase...');
  const [view, setView] = useState<FinanceView>('overview');
  const [dateStart, setDateStart] = useState(getMonthStart());
  const [dateEnd, setDateEnd] = useState(getToday());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'Todos'>('Todos');
  const [kindFilter, setKindFilter] = useState<ExpenseKind | 'Todos'>('Todos');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinanceExpense | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(emptyExpenseDraft);

  useEffect(() => {
    return subscribeExpenses(
      (remoteExpenses) => {
        setExpenses(remoteExpenses.length ? remoteExpenses : []);
        setSyncStatus('online');
        setSyncMessage(remoteExpenses.length ? 'Saídas sincronizadas com Firebase.' : 'Firebase conectado. Nenhuma saída cadastrada ainda.');
      },
      (error) => {
        setSyncStatus('local');
        setSyncMessage(`Modo local ativo: ${error.code}. Publique as regras do Firestore para persistir.`);
      },
    );
  }, []);

  const refreshSheetData = async (settings = integrationSettings) => {
    setLoadingSheets(true);
    try {
      const result = await loadSheetData(settings);
      setRevenue(result.sales.length ? result.sales : defaultRevenue);
      setTrafficExpenses(result.trafficExpenses.length ? result.trafficExpenses : []);
      setSheetMessage(result.errors.length ? `Planilhas com pendência: ${result.errors.join(' | ')}` : 'Planilhas sincronizadas com dados reais.');
    } finally {
      setLoadingSheets(false);
    }
  };

  useEffect(() => {
    return subscribeIntegrationSettings(
      (settings) => {
        setIntegrationSettings(settings);
        void refreshSheetData(settings);
      },
      () => {
        setIntegrationSettings(defaultIntegrationSettings);
        void refreshSheetData(defaultIntegrationSettings);
      },
    );
  }, []);

  const allExpenses = useMemo(() => [...trafficExpenses, ...expenses], [expenses, trafficExpenses]);
  const filteredRevenueByDate = useMemo(() => revenue.filter((item) => matchesDate(item.date, dateStart, dateEnd)), [dateEnd, dateStart, revenue]);
  const filteredExpensesByDate = useMemo(() => allExpenses.filter((expense) => matchesDate(expense.dueDate, dateStart, dateEnd)), [allExpenses, dateEnd, dateStart]);
  const trafficExpensesInPeriod = useMemo(() => trafficExpenses.filter((expense) => matchesDate(expense.dueDate, dateStart, dateEnd)), [dateEnd, dateStart, trafficExpenses]);
  const trafficGross = sum(trafficExpensesInPeriod.map((expense) => expense.rawAmount ?? 0));
  const trafficTax = sum(trafficExpensesInPeriod.map((expense) => expense.taxAmount ?? 0));
  const trafficTotal = sum(trafficExpensesInPeriod.map((expense) => expense.amount));
  const grossSalesRevenue = sum(filteredRevenueByDate.map((item) => item.grossRevenue ?? item.revenue));
  const platformFees = sum(filteredRevenueByDate.map((item) => item.platformFeeAmount ?? 0));
  const netSalesRevenue = sum(filteredRevenueByDate.map((item) => item.netRevenue ?? item.revenue));
  const totalRevenue = netSalesRevenue;
  const paidExpenses = sum(filteredExpensesByDate.filter((expense) => expense.status === 'Paga').map((expense) => expense.amount));
  const openExpenses = sum(filteredExpensesByDate.filter((expense) => expense.status === 'Aberta').map((expense) => expense.amount));
  const fixedExpenses = sum(filteredExpensesByDate.filter((expense) => expense.isRecurring).map((expense) => expense.amount));
  const projectedBalance = totalRevenue - paidExpenses - openExpenses;
  const realizedBalance = totalRevenue - paidExpenses;
  const margin = totalRevenue ? Math.round((projectedBalance / totalRevenue) * 100) : 0;
  const overdue = filteredExpensesByDate.filter((expense) => expense.status === 'Aberta' && isOverdue(expense.dueDate));

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return filteredExpensesByDate.filter((expense) => {
      const matchesSearch = !term || [expense.description, expense.category, expense.paymentMethod, expense.notes].some((value) => value.toLowerCase().includes(term));
      const matchesCategory = categoryFilter === 'Todas' || expense.category === categoryFilter;
      const matchesStatus = statusFilter === 'Todos' || expense.status === statusFilter;
      const matchesKind = kindFilter === 'Todos' || expense.kind === kindFilter;
      const matchesView = view !== 'recurring' || expense.isRecurring;
      return matchesSearch && matchesCategory && matchesStatus && matchesKind && matchesView;
    });
  }, [categoryFilter, filteredExpensesByDate, kindFilter, search, statusFilter, view]);

  const categoryData = useMemo(() => {
    const groups = filteredExpensesByDate.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [filteredExpensesByDate]);



  const openNewExpense = () => {
    setEditingExpense(null);
    setExpenseDraft(emptyExpenseDraft);
    setExpenseModalOpen(true);
  };

  const openEditExpense = (expense: FinanceExpense) => {
    setEditingExpense(expense);
    setExpenseDraft({
      description: expense.description,
      category: expense.category,
      kind: expense.kind,
      amount: expense.amount,
      dueDate: expense.dueDate,
      paidDate: expense.paidDate,
      status: expense.status,
      isRecurring: expense.isRecurring,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes,
    });
    setExpenseModalOpen(true);
  };

  const saveExpense = async () => {
    if (!expenseDraft.description.trim() || expenseDraft.amount <= 0) return;
    const normalized = {
      ...expenseDraft,
      amount: Number(expenseDraft.amount),
      paidDate: expenseDraft.status === 'Paga' ? expenseDraft.paidDate || new Date().toISOString().slice(0, 10) : '',
    };

    if (editingExpense) {
      await persistExpensePatch(editingExpense.id, normalized);
    } else if (syncStatus === 'online') {
      try {
        await createExpense(normalized);
      } catch (error) {
        addLocalExpense(normalized);
        setSyncStatus('local');
        setSyncMessage(`Saída salva localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
      }
    } else {
      addLocalExpense(normalized);
    }

    setExpenseModalOpen(false);
  };

  const persistExpensePatch = async (id: string, patch: Partial<ExpenseDraft>) => {
    setExpenses((current) => current.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)));
    if (syncStatus !== 'online' || id.startsWith('local-')) return;
    try {
      await updateExpense(id, patch);
    } catch (error) {
      setSyncStatus('local');
      setSyncMessage(`Alteração mantida localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
    }
  };

  const deleteExpense = async (expense: FinanceExpense) => {
    setExpenses((current) => current.filter((item) => item.id !== expense.id));
    if (syncStatus !== 'online' || expense.id.startsWith('local-')) return;
    try {
      await removeExpense(expense.id);
    } catch (error) {
      setSyncStatus('local');
      setSyncMessage(`Exclusão aplicada localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
    }
  };

  const togglePaid = (expense: FinanceExpense) => {
    const nextStatus: ExpenseStatus = expense.status === 'Paga' ? 'Aberta' : 'Paga';
    persistExpensePatch(expense.id, {
      status: nextStatus,
      paidDate: nextStatus === 'Paga' ? new Date().toISOString().slice(0, 10) : '',
    });
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('Todas');
    setStatusFilter('Todos');
    setKindFilter('Todos');
  };

  const addLocalExpense = (draft: ExpenseDraft) => {
    setExpenses((current) => [{ id: `local-fin-${Date.now()}`, ...draft }, ...current]);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Caixa e operação</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Financeiro</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
            Entradas vêm das planilhas de vendas. Saídas são lançadas aqui para acompanhar caixa, contas fixas e margem operacional.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeControl start={dateStart} end={dateEnd} onStart={setDateStart} onEnd={setDateEnd} resetLabel="Este mês" onReset={() => { setDateStart(getMonthStart()); setDateEnd(getToday()); }} />
          <button
            type="button"
            onClick={() => void refreshSheetData()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loadingSheets}
            title={sheetMessage}
          >
            <RefreshCw size={13} className={cn(loadingSheets && 'animate-spin')} />
            Atualizar planilhas
          </button>
          <button onClick={openNewExpense} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500">
            <Plus size={13} />
            Lançar saída
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Entradas por vendas" value={money.format(totalRevenue)} detail={`vendas ${money.format(grossSalesRevenue)} - taxas ${money.format(platformFees)}`} icon={TrendingUp} tone="blue" />
        <MetricCard label="Saídas totais" value={money.format(paidExpenses + openExpenses)} detail={`${money.format(trafficTotal)} vêm de tráfego`} icon={TrendingDown} tone="amber" />
        <MetricCard label="Tráfego importado" value={money.format(trafficTotal)} detail={`mídia ${money.format(trafficGross)} + ${money.format(trafficTax)} imposto`} icon={FileSpreadsheet} tone="blue" />
        <MetricCard label="Saldo projetado" value={money.format(projectedBalance)} detail={`${margin}% de margem prevista`} icon={Wallet} tone={projectedBalance >= 0 ? 'green' : 'rose'} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12px] leading-5 text-slate-700 shadow-sm dark:border-slate-900/60 dark:bg-slate-950 dark:text-slate-400">
        <span className="font-bold text-slate-950 dark:text-slate-200">Auditoria financeira:</span> {filteredRevenueByDate.length} venda(s) no período. Venda bruta: <span className="font-mono font-bold text-slate-950 dark:text-slate-100">{money.format(grossSalesRevenue)}</span>. Taxas configuradas: <span className="font-mono font-bold text-slate-950 dark:text-slate-100">{money.format(platformFees)}</span>. Entrada líquida estimada: <span className="font-mono font-bold text-slate-950 dark:text-slate-100">{money.format(netSalesRevenue)}</span>.
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <FinanceSnapshot
            totalRevenue={totalRevenue}
            paidExpenses={paidExpenses}
            openExpenses={openExpenses}
            projectedBalance={projectedBalance}
            trafficTotal={trafficTotal}
            overdueCount={overdue.length}
            view={view}
            onView={setView}
          />

          <ExpensePanel
            view={view}
            expenses={filteredExpenses}
            search={search}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            kindFilter={kindFilter}
            onSearch={setSearch}
            onCategory={setCategoryFilter}
            onStatus={(value) => setStatusFilter(value as ExpenseStatus | 'Todos')}
            onKind={(value) => setKindFilter(value as ExpenseKind | 'Todos')}
            onReset={resetFilters}
            onEdit={openEditExpense}
            onDelete={deleteExpense}
            onTogglePaid={togglePaid}
          />
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Resumo operacional</h2>
                <p className="mt-1 text-[11px] text-slate-500">Resultado previsto se tudo for pago.</p>
              </div>
              <Banknote size={16} className="text-blue-400" />
            </div>
            <div className="mt-5 space-y-3">
              <SummaryLine label="Saldo realizado" value={money.format(realizedBalance)} />
              <SummaryLine label="Contas futuras" value={money.format(openExpenses)} />
              <SummaryLine label="Tráfego bruto" value={money.format(trafficGross)} />
              <SummaryLine label="Imposto tráfego" value={money.format(trafficTax)} />
              <SummaryLine label="Fixas mensais" value={money.format(fixedExpenses)} />
              <SummaryLine label="Ticket médio" value={money.format(totalRevenue / Math.max(sum(filteredRevenueByDate.map((item) => item.orders)), 1))} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <h2 className="text-sm font-semibold text-slate-200">Saídas por categoria</h2>
            <p className="mt-1 text-[11px] text-slate-500">Onde o caixa está sendo consumido.</p>
            <div className="mt-4 h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3}>
                    {categoryData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {categoryData.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-2 text-slate-400"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item.name}</span>
                  <span className="font-mono text-slate-500">{money.format(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <TrafficTaxBox gross={trafficGross} tax={trafficTax} total={trafficTotal} />

          <AlertBox overdue={overdue} onEdit={openEditExpense} />
        </aside>
      </section>

      {expenseModalOpen && (
        <ExpenseModal
          title={editingExpense ? 'Editar saída' : 'Lançar saída'}
          draft={expenseDraft}
          onChange={setExpenseDraft}
          onClose={() => setExpenseModalOpen(false)}
          onSave={saveExpense}
        />
      )}
    </div>
  );
}


function DateRangeControl({ start, end, onStart, onEnd, onReset, resetLabel }: { start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void; onReset: () => void; resetLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 min-w-[250px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-[12px] font-semibold text-black shadow-sm transition-colors hover:border-blue-400"
      >
        <CalendarDays size={14} className="text-blue-600" />
        <span>{formatDate(start)} - {formatDate(end)}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/15">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Início</span><input className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-[12px] font-semibold text-black outline-none focus:ring-1 focus:ring-blue-600" type="date" value={start} onChange={(event) => onStart(event.target.value)} /></label>
            <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fim</span><input className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-[12px] font-semibold text-black outline-none focus:ring-1 focus:ring-blue-600" type="date" value={end} onChange={(event) => onEnd(event.target.value)} /></label>
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <button type="button" onClick={onReset} className="rounded-lg px-3 py-2 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-50">{resetLabel}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceSnapshot({
  totalRevenue,
  paidExpenses,
  openExpenses,
  projectedBalance,
  trafficTotal,
  overdueCount,
  view,
  onView,
}: {
  totalRevenue: number;
  paidExpenses: number;
  openExpenses: number;
  projectedBalance: number;
  trafficTotal: number;
  overdueCount: number;
  view: FinanceView;
  onView: (value: FinanceView) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Acompanhamento rápido</h2>
          <p className="mt-1 text-[11px] text-slate-500">Leitura simples do período selecionado.</p>
        </div>
        <ViewSwitcher value={view} onChange={onView} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <SnapshotItem label="Entrou" value={money.format(totalRevenue)} tone="text-emerald-400" />
        <SnapshotItem label="Saiu pago" value={money.format(paidExpenses)} tone="text-blue-400" />
        <SnapshotItem label="Ainda aberto" value={money.format(openExpenses)} tone="text-amber-300" />
        <SnapshotItem label="Tráfego" value={money.format(trafficTotal)} tone="text-sky-400" />
        <SnapshotItem label="Saldo previsto" value={money.format(projectedBalance)} tone={projectedBalance >= 0 ? 'text-emerald-400' : 'text-rose-300'} />
        <SnapshotItem label="Atrasadas" value={String(overdueCount)} tone={overdueCount ? 'text-rose-300' : 'text-slate-300'} />
      </div>
    </div>
  );
}

function SnapshotItem({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-900 bg-slate-950/70 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={cn('mt-2 font-mono text-lg font-bold tracking-tighter', tone)}>{value}</p>
    </div>
  );
}

function ExpensePanel({
  view,
  expenses,
  search,
  categoryFilter,
  statusFilter,
  kindFilter,
  onSearch,
  onCategory,
  onStatus,
  onKind,
  onReset,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  view: FinanceView;
  expenses: FinanceExpense[];
  search: string;
  categoryFilter: string;
  statusFilter: string;
  kindFilter: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onStatus: (value: string) => void;
  onKind: (value: string) => void;
  onReset: () => void;
  onEdit: (expense: FinanceExpense) => void;
  onDelete: (expense: FinanceExpense) => void;
  onTogglePaid: (expense: FinanceExpense) => void;
}) {
  const [openGroup, setOpenGroup] = useState<ExpenseGroup | null>(null);
  const groups = useMemo(() => groupExpensesByCategory(expenses), [expenses]);

  return (
    <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{view === 'recurring' ? 'Contas fixas' : 'Saídas por categoria'}</h2>
          <p className="mt-1 text-[11px] text-slate-500">Resumo concentrado das saídas. Abra uma categoria para ver todos os lançamentos, incluindo tráfego com imposto de 13,83%.</p>
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input className={cn(inputClass, 'pl-8')} placeholder="Buscar saída" value={search} onChange={(event) => onSearch(event.target.value)} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-900 bg-slate-950/70 p-3 md:grid-cols-5">
        <SelectFilter label="Categoria" value={categoryFilter} onChange={onCategory} options={['Todas', ...expenseCategories]} />
        <SelectFilter label="Status" value={statusFilter} onChange={onStatus} options={['Todos', ...expenseStatuses]} />
        <SelectFilter label="Tipo" value={kindFilter} onChange={onKind} options={['Todos', ...expenseKinds]} />
        <button onClick={onReset} className="h-9 self-end rounded-lg border border-slate-800 px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-200">
          Limpar
        </button>
        <p className="self-end text-right text-[11px] text-slate-600">{expenses.length} saída(s)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-900">
        {groups.length ? groups.map((group) => (
          <button
            key={group.category}
            type="button"
            onClick={() => setOpenGroup(group)}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-900 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-900/35 md:grid-cols-[1.2fr_0.8fr_0.7fr_auto]"
          >
            <div>
              <p className="text-[12px] font-semibold text-slate-200">{group.category}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{group.count} lançamento(s) · {group.trafficCount ? `${group.trafficCount} de tráfego` : 'manual'}</p>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">Pago</p>
              <p className="mt-1 font-mono text-[12px] font-bold text-emerald-300">{money.format(group.paidAmount)}</p>
            </div>
            <div className="hidden md:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">Aberto</p>
              <p className="mt-1 font-mono text-[12px] font-bold text-amber-300">{money.format(group.openAmount)}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[14px] font-bold text-slate-100">{money.format(group.total)}</p>
              <p className="mt-1 text-[10px] font-semibold text-blue-300">Ver detalhes</p>
            </div>
          </button>
        )) : (
          <div className="px-4 py-10 text-center text-[12px] text-slate-500">Nenhuma saída encontrada.</div>
        )}
      </div>

      {openGroup && (
        <ExpenseGroupModal
          group={openGroup}
          onClose={() => setOpenGroup(null)}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePaid={onTogglePaid}
        />
      )}
    </div>
  );
}

type ExpenseGroup = {
  category: string;
  expenses: FinanceExpense[];
  total: number;
  paidAmount: number;
  openAmount: number;
  count: number;
  trafficCount: number;
};

function groupExpensesByCategory(expenses: FinanceExpense[]): ExpenseGroup[] {
  const groups = expenses.reduce<Record<string, ExpenseGroup>>((acc, expense) => {
    const category = expense.category || 'Outros';
    acc[category] = acc[category] ?? { category, expenses: [], total: 0, paidAmount: 0, openAmount: 0, count: 0, trafficCount: 0 };
    acc[category].expenses.push(expense);
    acc[category].total += expense.amount;
    acc[category].count += 1;
    acc[category].trafficCount += expense.source === 'traffic' ? 1 : 0;
    if (expense.status === 'Paga') acc[category].paidAmount += expense.amount;
    if (expense.status === 'Aberta') acc[category].openAmount += expense.amount;
    return acc;
  }, {});

  return Object.values(groups).sort((first, second) => second.total - first.total);
}

function ExpenseGroupModal({
  group,
  onClose,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  group: ExpenseGroup;
  onClose: () => void;
  onEdit: (expense: FinanceExpense) => void;
  onDelete: (expense: FinanceExpense) => void;
  onTogglePaid: (expense: FinanceExpense) => void;
}) {
  return (
    <Modal title={`${group.category} · ${money.format(group.total)}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <SnapshotItem label="Total" value={money.format(group.total)} tone="text-slate-100" />
        <SnapshotItem label="Pago" value={money.format(group.paidAmount)} tone="text-emerald-400" />
        <SnapshotItem label="Aberto" value={money.format(group.openAmount)} tone="text-amber-300" />
      </div>
      <div className="max-h-[58vh] overflow-y-auto rounded-xl border border-slate-900 custom-scrollbar">
        <div className="min-w-[760px] divide-y divide-slate-900">
          {group.expenses.map((expense) => (
            <div key={expense.id}>
              <ExpenseRow expense={expense} onEdit={onEdit} onDelete={onDelete} onTogglePaid={onTogglePaid} />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function ExpenseRow({ expense, onEdit, onDelete, onTogglePaid }: { expense: FinanceExpense; onEdit: (expense: FinanceExpense) => void; onDelete: (expense: FinanceExpense) => void; onTogglePaid: (expense: FinanceExpense) => void }) {
  return (
    <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_128px] items-center gap-4 px-4 py-3">
      <div>
        <button onClick={() => onEdit(expense)} className="text-left text-[12px] font-semibold text-slate-200 transition-colors hover:text-blue-300">
          {expense.description}
        </button>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{expense.kind} · {expense.paymentMethod}</p>
        {expense.source === 'traffic' && (
          <p className="mt-1 text-[10px] text-blue-300">Mídia {money.format(expense.rawAmount ?? 0)} + imposto {money.format(expense.taxAmount ?? 0)}</p>
        )}
      </div>
      <span className={cn('w-fit rounded border px-2 py-1 text-[10px] font-bold', expense.status === 'Paga' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300')}>{expense.status}</span>
      <span className={cn('text-[11px]', isOverdue(expense.dueDate) && expense.status === 'Aberta' ? 'text-rose-300' : 'text-slate-500')}>{formatDate(expense.dueDate)}</span>
      <span className="font-mono text-[12px] font-bold text-slate-200">{money.format(expense.amount)}</span>
      <div className="flex items-center justify-end gap-1">
        {expense.source === 'traffic' ? (
          <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300">Auto</span>
        ) : (
          <>
            <IconButton label={expense.status === 'Paga' ? 'Reabrir' : 'Marcar como paga'} onClick={() => onTogglePaid(expense)}><CheckCircle2 size={13} /></IconButton>
            <IconButton label="Editar" onClick={() => onEdit(expense)}><Edit3 size={13} /></IconButton>
            <IconButton label="Excluir" onClick={() => onDelete(expense)}><Trash2 size={13} /></IconButton>
          </>
        )}
      </div>
    </div>
  );
}

function ExpenseModal({ title, draft, onChange, onClose, onSave }: { title: string; draft: ExpenseDraft; onChange: (draft: ExpenseDraft) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Descrição" className="md:col-span-2"><input className={inputClass} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} autoFocus /></Field>
        <Field label="Valor"><input className={inputClass} type="number" min={0} step="0.01" value={draft.amount || ''} onChange={(event) => onChange({ ...draft, amount: Number(event.target.value) })} /></Field>
        <Field label="Vencimento"><input className={inputClass} type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })} /></Field>
        <Field label="Categoria"><select className={inputClass} value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></Field>
        <Field label="Tipo"><select className={inputClass} value={draft.kind} onChange={(event) => onChange({ ...draft, kind: event.target.value as ExpenseKind })}>{expenseKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></Field>
        <Field label="Status"><select className={inputClass} value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as ExpenseStatus })}>{expenseStatuses.map((status) => <option key={status}>{status}</option>)}</select></Field>
        <Field label="Pagamento"><input className={inputClass} value={draft.paymentMethod} onChange={(event) => onChange({ ...draft, paymentMethod: event.target.value })} /></Field>
        <label className="flex h-9 items-center justify-between rounded-lg border border-slate-800 px-3 md:col-span-2">
          <span className="text-[12px] font-medium text-slate-300">Conta fixa / recorrente</span>
          <input type="checkbox" checked={draft.isRecurring} onChange={(event) => onChange({ ...draft, isRecurring: event.target.checked })} />
        </label>
        <Field label="Observações" className="md:col-span-2"><textarea className={cn(inputClass, 'h-24 py-2')} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100">Cancelar</button>
        <button onClick={onSave} disabled={!draft.description.trim() || draft.amount <= 0} className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Salvar saída</button>
      </div>
    </Modal>
  );
}

function ViewSwitcher({ value, onChange }: { value: FinanceView; onChange: (value: FinanceView) => void }) {
  const options: Array<{ id: FinanceView; label: string; icon: typeof Wallet }> = [
    { id: 'overview', label: 'Visão', icon: Wallet },
    { id: 'expenses', label: 'Saídas', icon: ReceiptText },
    { id: 'recurring', label: 'Fixas', icon: Repeat2 },
  ];
  return <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">{options.map((option) => { const Icon = option.icon; return <button key={option.id} onClick={() => onChange(option.id)} className={cn('inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors', value === option.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-200')}><Icon size={13} />{option.label}</button>; })}</div>;
}

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Wallet; tone: 'blue' | 'green' | 'amber' | 'rose' }) {
  const tones = { blue: 'text-blue-400', green: 'text-emerald-400', amber: 'text-amber-300', rose: 'text-rose-300' };
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold tracking-tighter text-slate-100">{value}</p></div><div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50', tones[tone])}><Icon size={15} /></div></div><p className="mt-2 text-[11px] text-slate-600">{detail}</p></motion.div>;
}


function TrafficTaxBox({ gross, tax, total }: { gross: number; tax: number; total: number }) {
  return (
    <div className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <FileSpreadsheet size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Tráfego automático</h2>
          <p className="text-[11px] text-slate-500">Planilhas de anúncios + imposto.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <SummaryLine label="Gasto em mídia" value={money.format(gross)} />
        <SummaryLine label={`Imposto ${(TRAFFIC_TAX_RATE * 100).toFixed(2).replace('.', ',')}%`} value={money.format(tax)} />
        <SummaryLine label="Total contabilizado" value={money.format(total)} />
      </div>
    </div>
  );
}

function AlertBox({ overdue, onEdit }: { overdue: FinanceExpense[]; onEdit: (expense: FinanceExpense) => void }) {
  return <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-300"><AlertTriangle size={16} /></div><div><h2 className="text-sm font-semibold text-slate-200">Alertas</h2><p className="text-[11px] text-slate-500">Contas que pedem ação.</p></div></div><div className="mt-5 space-y-3">{overdue.length ? overdue.map((expense) => <button key={expense.id} onClick={() => onEdit(expense)} className="block w-full rounded-lg border border-slate-900 bg-slate-950/70 p-3 text-left"><p className="text-[11px] font-semibold text-slate-300">{expense.description}</p><p className="mt-1 text-[10px] text-rose-300">Venceu em {formatDate(expense.dueDate)} · {money.format(expense.amount)}</p></button>) : <p className="rounded-lg border border-slate-900 bg-slate-950/70 p-3 text-[11px] text-slate-500">Nenhuma conta atrasada.</p>}</div></div>;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2"><span className="text-[11px] text-slate-500">{label}</span><span className="font-mono text-[12px] font-bold text-slate-200">{value}</span></div>;
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="space-y-2"><span className={labelClass}>{label}</span><select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={cn('space-y-2', className)}><span className={labelClass}>{label}</span>{children}</label>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:text-slate-200">{children}</button>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-100">{title}</h2><IconButton label="Fechar" onClick={onClose}><X size={14} /></IconButton></div>{children}</div></div>;
}

function SyncBadge({ status, children }: { status: SyncStatus; children: ReactNode }) {
  const color = status === 'online' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : status === 'local' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-400';
  return <span className={cn('max-w-[320px] truncate rounded border px-2 py-1 text-[10px] font-bold', color)} title={typeof children === 'string' ? children : undefined}>{children}</span>;
}


function matchesDate(date: string, start: string, end: string) {
  if (!date) return true;
  return (!start || date >= start) && (!end || date <= end);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStart() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
}

function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function formatDate(date: string) { return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`)) : 'Sem data'; }
function isOverdue(date: string) { if (!date) return false; const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(`${date}T00:00:00`); return due < today; }
function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : 'erro desconhecido'; }
