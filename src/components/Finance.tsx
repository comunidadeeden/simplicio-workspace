import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Edit3,
  FileSpreadsheet,
  Filter,
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
  defaultTrafficExpenses,
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
import { cn } from '../lib/utils';

type SyncStatus = 'connecting' | 'online' | 'local';
type FinanceView = 'overview' | 'expenses' | 'recurring';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#a78bfa', '#64748b'];
const inputClass = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';

export function Finance() {
  const [expenses, setExpenses] = useState<FinanceExpense[]>(defaultExpenses);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncMessage, setSyncMessage] = useState('Conectando ao Firebase...');
  const [view, setView] = useState<FinanceView>('overview');
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

  const revenue = defaultRevenue;
  const allExpenses = useMemo(() => [...defaultTrafficExpenses, ...expenses], [expenses]);
  const trafficGross = sum(defaultTrafficExpenses.map((expense) => expense.rawAmount ?? 0));
  const trafficTax = sum(defaultTrafficExpenses.map((expense) => expense.taxAmount ?? 0));
  const trafficTotal = sum(defaultTrafficExpenses.map((expense) => expense.amount));
  const totalRevenue = sum(revenue.map((item) => item.revenue));
  const paidExpenses = sum(allExpenses.filter((expense) => expense.status === 'Paga').map((expense) => expense.amount));
  const openExpenses = sum(allExpenses.filter((expense) => expense.status === 'Aberta').map((expense) => expense.amount));
  const fixedExpenses = sum(allExpenses.filter((expense) => expense.isRecurring).map((expense) => expense.amount));
  const projectedBalance = totalRevenue - paidExpenses - openExpenses;
  const realizedBalance = totalRevenue - paidExpenses;
  const margin = totalRevenue ? Math.round((projectedBalance / totalRevenue) * 100) : 0;
  const overdue = allExpenses.filter((expense) => expense.status === 'Aberta' && isOverdue(expense.dueDate));

  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allExpenses.filter((expense) => {
      const matchesSearch = !term || [expense.description, expense.category, expense.paymentMethod, expense.notes].some((value) => value.toLowerCase().includes(term));
      const matchesCategory = categoryFilter === 'Todas' || expense.category === categoryFilter;
      const matchesStatus = statusFilter === 'Todos' || expense.status === statusFilter;
      const matchesKind = kindFilter === 'Todos' || expense.kind === kindFilter;
      const matchesView = view !== 'recurring' || expense.isRecurring;
      return matchesSearch && matchesCategory && matchesStatus && matchesKind && matchesView;
    });
  }, [allExpenses, categoryFilter, kindFilter, search, statusFilter, view]);

  const categoryData = useMemo(() => {
    const groups = allExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {});
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [allExpenses]);

  const cashFlow = revenue.map((point) => {
    const dayExpenses = allExpenses.filter((expense) => expense.dueDate === point.date).reduce((total, expense) => total + expense.amount, 0);
    return { name: point.label, entradas: point.revenue, saidas: dayExpenses, saldo: point.revenue - dayExpenses };
  });

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
          <SyncBadge status={syncStatus}>{syncMessage}</SyncBadge>
          <button onClick={openNewExpense} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500">
            <Plus size={13} />
            Lançar saída
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Entradas por vendas" value={money.format(totalRevenue)} detail="via planilhas das plataformas" icon={TrendingUp} tone="blue" />
        <MetricCard label="Saídas totais" value={money.format(paidExpenses + openExpenses)} detail={`${money.format(trafficTotal)} vêm de tráfego`} icon={TrendingDown} tone="amber" />
        <MetricCard label="Tráfego importado" value={money.format(trafficTotal)} detail={`mídia ${money.format(trafficGross)} + ${money.format(trafficTax)} imposto`} icon={FileSpreadsheet} tone="blue" />
        <MetricCard label="Saldo projetado" value={money.format(projectedBalance)} detail={`${margin}% de margem prevista`} icon={Wallet} tone={projectedBalance >= 0 ? 'green' : 'rose'} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Fluxo do mês</h2>
                <p className="mt-1 text-[11px] text-slate-500">Entradas importadas versus saídas manuais e tráfego com imposto.</p>
              </div>
              <ViewSwitcher value={view} onChange={setView} />
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlow}>
                  <defs>
                    <linearGradient id="financeIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.16}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                    <linearGradient id="financeOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.12}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#334155" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} formatter={(value) => money.format(Number(value))} />
                  <Area type="monotone" dataKey="entradas" stroke="#22c55e" strokeWidth={2} fill="url(#financeIn)" />
                  <Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} fill="url(#financeOut)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

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
              <SummaryLine label="Ticket médio" value={money.format(totalRevenue / Math.max(sum(revenue.map((item) => item.orders)), 1))} />
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
  return (
    <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{view === 'recurring' ? 'Contas fixas' : 'Saídas totais'}</h2>
          <p className="mt-1 text-[11px] text-slate-500">Saídas manuais somadas ao tráfego importado com imposto de 12,15%.</p>
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

      <div className="overflow-x-auto rounded-xl border border-slate-900 custom-scrollbar">
        <div className="min-w-[860px] divide-y divide-slate-900">
          {expenses.length ? expenses.map((expense) => (
            <div key={expense.id} className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr_128px] items-center gap-4 px-4 py-3">
              <div>
                <button onClick={() => onEdit(expense)} className="text-left text-[12px] font-semibold text-slate-200 transition-colors hover:text-blue-300">
                  {expense.description}
                </button>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{expense.category} · {expense.paymentMethod}</p>
                {expense.source === 'traffic' && (
                  <p className="mt-1 text-[10px] text-blue-300">Mídia {money.format(expense.rawAmount ?? 0)} + imposto {money.format(expense.taxAmount ?? 0)}</p>
                )}
              </div>
              <span className={cn('w-fit rounded border px-2 py-1 text-[10px] font-bold', expense.status === 'Paga' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300')}>{expense.status}</span>
              <span className="text-[11px] text-slate-400">{expense.kind}</span>
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
          )) : (
            <div className="px-4 py-10 text-center text-[12px] text-slate-500">Nenhuma saída encontrada.</div>
          )}
        </div>
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

function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function formatDate(date: string) { return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`)) : 'Sem data'; }
function isOverdue(date: string) { if (!date) return false; const today = new Date(); today.setHours(0, 0, 0, 0); const due = new Date(`${date}T00:00:00`); return due < today; }
function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : 'erro desconhecido'; }
