import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Filter,
  Flag,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  createTask,
  createRoutine,
  createTeamMember,
  defaultTasks,
  defaultTeamMembers,
  removeRoutine,
  removeTask,
  subscribeRoutines,
  subscribeTasks,
  subscribeTeamMembers,
  taskPriorities,
  taskStatuses,
  updateRoutine,
  updateTask,
  type MemberDraft,
  type RoutineDraft,
  type RoutineFrequency,
  type TaskDraft,
  type TaskPriority,
  type TaskStatus,
  type TeamMember,
  type TeamRoutine,
  type TeamTask,
} from '../lib/activities';
import type { UserProfile } from '../lib/auth';
import { cn } from '../lib/utils';

type ViewMode = 'board' | 'list' | 'calendar';
type PeriodFilter = 'all' | 'today' | 'week' | 'overdue';
type FocusFilter = 'all' | 'today' | 'overdue' | 'high' | 'unassigned';
type SyncStatus = 'connecting' | 'online' | 'local';

const emptyTaskDraft: TaskDraft = {
  title: '',
  project: '',
  owner: '',
  ownerEmail: '',
  status: 'Backlog',
  priority: 'Média',
  dueDate: '',
  effort: '',
  tags: [],
  notes: '',
};

const emptyRoutineDraft: RoutineDraft = {
  title: '',
  project: '',
  owner: '',
  ownerEmail: '',
  priority: 'Média',
  startDate: new Date().toISOString().slice(0, 10),
  time: '09:00',
  frequency: 'daily',
  weekdays: [new Date().getDay()],
  completedOccurrences: [],
  notes: '',
  tags: [],
  active: true,
};

const emptyMemberDraft: MemberDraft = {
  name: '',
  role: '',
  capacity: 1,
  email: '',
};

const priorityStyles: Record<TaskPriority, string> = {
  Alta: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  Média: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Baixa: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
};

const inputClass =
  'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';
const weekdayOptions = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export function Activities({ userProfile }: { userProfile: UserProfile }) {
  const isAdmin = userProfile.role === 'admin';
  const [tasks, setTasks] = useState<TeamTask[]>(isAdmin ? defaultTasks : []);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(defaultTeamMembers);
  const [routines, setRoutines] = useState<TeamRoutine[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncMessage, setSyncMessage] = useState('Conectando ao Firebase...');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [showFilters, setShowFilters] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'Todos'>('Todos');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'Todas'>('Todas');
  const [ownerFilter, setOwnerFilter] = useState('Todos');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [activeFocus, setActiveFocus] = useState<FocusFilter>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(emptyTaskDraft);
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(emptyMemberDraft);
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>(emptyRoutineDraft);

  useEffect(() => {
    const unsubscribeTasks = subscribeTasks(
      userProfile,
      (remoteTasks) => {
        setTasks(remoteTasks);
        setSyncStatus('online');
        setSyncMessage(remoteTasks.length ? 'Sincronizado com Firebase.' : 'Firebase conectado. Nenhuma atividade cadastrada ainda.');
      },
      (error) => {
        setSyncStatus('local');
        setSyncMessage(`Modo local ativo: ${error.code}. Publique as regras do Firestore para persistir.`);
      },
    );

    const unsubscribeMembers = isAdmin ? subscribeTeamMembers(
      (remoteMembers) => {
        if (remoteMembers.length) setTeamMembers(remoteMembers);
      },
      () => undefined,
    ) : () => undefined;

    const unsubscribeRoutines = subscribeRoutines(
      userProfile,
      (remoteRoutines) => setRoutines(remoteRoutines.sort((first, second) => getRoutineSortValue(first) - getRoutineSortValue(second))),
      () => undefined,
    );

    return () => {
      unsubscribeTasks();
      unsubscribeMembers();
      unsubscribeRoutines();
    };
  }, [isAdmin, userProfile]);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !term ||
        [task.title, task.project, task.owner, task.notes, task.tags.join(' ')].some((value) => value.toLowerCase().includes(term));
      const matchesStatus = statusFilter === 'Todos' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'Todas' || task.priority === priorityFilter;
      const matchesOwner = !isAdmin || ownerFilter === 'Todos' || task.owner === ownerFilter;
      const matchesPeriod = matchesPeriodFilter(task.dueDate, periodFilter);
      const matchesFocus =
        activeFocus === 'all' ||
        (activeFocus === 'today' && matchesPeriodFilter(task.dueDate, 'today')) ||
        (activeFocus === 'overdue' && matchesPeriodFilter(task.dueDate, 'overdue')) ||
        (activeFocus === 'high' && task.priority === 'Alta' && task.status !== 'Concluído') ||
        (activeFocus === 'unassigned' && !task.owner);

      return matchesSearch && matchesStatus && matchesPriority && matchesOwner && matchesPeriod && matchesFocus;
    });
  }, [activeFocus, isAdmin, ownerFilter, periodFilter, priorityFilter, search, statusFilter, tasks]);

  const todayCount = tasks.filter((task) => task.status !== 'Concluído' && matchesPeriodFilter(task.dueDate, 'today')).length;
  const overdueCount = tasks.filter((task) => task.status !== 'Concluído' && matchesPeriodFilter(task.dueDate, 'overdue')).length;
  const unassignedCount = tasks.filter((task) => !task.owner && task.status !== 'Concluído').length;
  const completed = tasks.filter((task) => task.status === 'Concluído').length;
  const atRisk = tasks.filter((task) => task.priority === 'Alta' && task.status !== 'Concluído').length;
  const inProgress = tasks.filter((task) => task.status === 'Em andamento').length;
  const myActiveTasks = tasks.filter((task) => task.ownerEmail === userProfile.email && task.status !== 'Concluído').length;
  const dueRoutines = routines.filter((routine) => isRoutineDueToday(routine) && !isRoutineCompletedForCurrentOccurrence(routine));
  const myDueRoutines = dueRoutines.filter((routine) => routine.ownerEmail === userProfile.email).length;
  const openNewTask = () => {
    setEditingTask(null);
    setTaskDraft(isAdmin ? { ...emptyTaskDraft, owner: teamMembers[0]?.name ?? '', ownerEmail: teamMembers[0]?.email ?? '' } : { ...emptyTaskDraft, owner: userProfile.name, ownerEmail: userProfile.email, status: 'Em andamento' });
    setTaskModalOpen(true);
  };

  const openEditTask = (task: TeamTask) => {
    setEditingTask(task);
    setTaskDraft({
      title: task.title,
      project: task.project,
      owner: task.owner,
      ownerEmail: task.ownerEmail,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      effort: task.effort,
      tags: task.tags,
      notes: task.notes,
    });
    setTaskModalOpen(true);
  };

  const saveTask = async () => {
    if (!taskDraft.title.trim()) return;

    const normalizedTask = normalizeTaskDraft(taskDraft, teamMembers, userProfile);

    if (editingTask) {
      await persistTaskPatch(editingTask.id, normalizedTask);
    } else if (syncStatus === 'online') {
      try {
        await createTask(normalizedTask);
      } catch (error) {
        addLocalTask(normalizedTask);
        setSyncStatus('local');
        setSyncMessage(`Atividade salva localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
      }
    } else {
      addLocalTask(normalizedTask);
    }

    setTaskModalOpen(false);
  };

  const openNewRoutine = () => {
    const member = isAdmin ? teamMembers[0] : undefined;
    setRoutineDraft({
      ...emptyRoutineDraft,
      owner: isAdmin ? member?.name ?? '' : userProfile.name,
      ownerEmail: isAdmin ? member?.email ?? '' : userProfile.email,
      startDate: new Date().toISOString().slice(0, 10),
    });
    setRoutineModalOpen(true);
  };

  const saveRoutine = async () => {
    if (!routineDraft.title.trim()) return;

    const normalizedRoutine = normalizeRoutineDraft(routineDraft, teamMembers, userProfile);

    if (syncStatus === 'online') {
      try {
        await createRoutine(normalizedRoutine);
      } catch (error) {
        addLocalRoutine(normalizedRoutine);
        setSyncStatus('local');
        setSyncMessage(`Rotina salva localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
      }
    } else {
      addLocalRoutine(normalizedRoutine);
    }

    setRoutineDraft(emptyRoutineDraft);
    setRoutineModalOpen(false);
  };

  const completeRoutine = async (routine: TeamRoutine) => {
    const occurrence = getRoutineOccurrenceKey(routine);
    const completedOccurrences = Array.from(new Set([...(routine.completedOccurrences ?? []), occurrence]));

    setRoutines((current) => current.map((item) => (item.id === routine.id ? { ...item, completedOccurrences } : item)));

    if (syncStatus !== 'online' || routine.id.startsWith('local-')) return;

    try {
      await updateRoutine(routine.id, { completedOccurrences });
    } catch (error) {
      setSyncStatus('local');
      setSyncMessage(`Rotina concluída localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
    }
  };

  const deleteRoutine = async (routine: TeamRoutine) => {
    setRoutines((current) => current.filter((item) => item.id !== routine.id));

    if (syncStatus !== 'online' || routine.id.startsWith('local-')) return;

    try {
      await removeRoutine(routine.id);
    } catch (error) {
      setSyncStatus('local');
      setSyncMessage(`Rotina removida localmente. Firebase recusou a exclusão: ${getErrorMessage(error)}.`);
    }
  };

  const saveMember = async () => {
    if (!memberDraft.name.trim()) return;

    const newMember = { ...memberDraft, email: memberDraft.email.trim().toLowerCase(), capacity: Number(memberDraft.capacity) || 1 };

    if (syncStatus === 'online') {
      try {
        await createTeamMember(newMember);
      } catch (error) {
        addLocalMember(newMember);
        setSyncStatus('local');
        setSyncMessage(`Membro salvo localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
      }
    } else {
      addLocalMember(newMember);
    }

    setMemberDraft(emptyMemberDraft);
    setMemberModalOpen(false);
  };

  const persistTaskPatch = async (id: string, patch: Partial<TaskDraft>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));

    if (syncStatus !== 'online' || id.startsWith('local-')) return;

    try {
      await updateTask(id, patch);
    } catch (error) {
      setSyncStatus('local');
      setSyncMessage(`Alteração mantida localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
    }
  };

  const deleteTask = async (task: TeamTask) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));

    if (syncStatus !== 'online' || task.id.startsWith('local-')) return;

    try {
      await removeTask(task.id);
    } catch (error) {
      setSyncStatus('local');
      setSyncMessage(`Exclusão aplicada localmente. Firebase recusou a gravação: ${getErrorMessage(error)}.`);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('Todos');
    setPriorityFilter('Todas');
    setOwnerFilter('Todos');
    setPeriodFilter('all');
    setActiveFocus('all');
  };

  const applyFocus = (focus: FocusFilter) => {
    setActiveFocus(focus);
    setSearch('');
    setStatusFilter('Todos');
    setPriorityFilter('Todas');
    setOwnerFilter('Todos');
    setPeriodFilter('all');
  };

  const addLocalTask = (draft: TaskDraft) => {
    setTasks((current) => [{ id: `local-${Date.now()}`, ...draft }, ...current]);
  };

  const addLocalRoutine = (draft: RoutineDraft) => {
    setRoutines((current) => [{ id: `local-routine-${Date.now()}`, ...draft, completedOccurrences: draft.completedOccurrences ?? [] }, ...current]);
  };

  const addLocalMember = (draft: MemberDraft) => {
    setTeamMembers((current) => [{ id: `local-member-${Date.now()}`, ...draft }, ...current]);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Operação da equipe</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Atividades</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
            Organize tarefas do dia, rotinas recorrentes e prioridades da equipe com controle por usuário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <HeaderCounter label="Minhas ativas" value={myActiveTasks} />
          <HeaderCounter label="Rotinas hoje" value={myDueRoutines} />
          {isAdmin && (
            <select
              className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-3 text-[11px] font-semibold text-slate-400 outline-none focus:ring-1 focus:ring-blue-600"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              aria-label="Filtrar responsável"
            >
              <option value="Todos">Todos responsáveis</option>
              {teamMembers.map((member) => <option key={member.email} value={member.name}>{member.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowFilters((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100"
          >
            <Filter size={13} />
            Filtros
          </button>
          {isAdmin && (
          <button
            onClick={() => setMemberModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100"
          >
            <UserPlus size={13} />
            Equipe
          </button>
          )}
          <button
            onClick={openNewTask}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500"
          >
            <Plus size={13} />
            Nova atividade
          </button>
        </div>
      </section>


      <FocusRail
        active={activeFocus}
        isAdmin={isAdmin}
        counts={{ all: tasks.length, today: todayCount, overdue: overdueCount, high: atRisk, unassigned: unassignedCount }}
        onChange={applyFocus}
      />

      <AttentionBanner tasks={tasks} onFocus={applyFocus} />

      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: 'Ativas', value: tasks.length - completed, detail: `${inProgress} em execução`, icon: CheckCircle2 },
          { label: 'Minhas', value: myActiveTasks, detail: 'em aberto', icon: Clock3 },
          { label: 'Rotinas', value: dueRoutines.length, detail: `${myDueRoutines} minhas`, icon: CalendarDays },
          { label: 'Alta', value: atRisk, detail: 'prioridade', icon: Flag },
          { label: 'Concluídas', value: completed, detail: `${filteredTasks.length} visíveis`, icon: CheckCircle2 },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-lg border border-slate-900/80 bg-slate-950 p-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{stat.label}</p>
                  <p className="mt-1 font-mono text-lg font-bold tracking-tighter text-slate-100">{stat.value}</p>
                </div>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400">
                  <Icon size={15} />
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-600">{stat.detail}</p>
            </motion.div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5 xl:col-span-9">
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Quadro de execução</h2>
                <p className="mt-1 text-[11px] text-slate-500">Alterne visualizações, edite status e encontre gargalos rapidamente.</p>
              </div>
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                <input
                  className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  placeholder="Buscar por tarefa, projeto, responsável ou tag"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-600">{filteredTasks.length} de {tasks.length} atividades</p>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-900 bg-slate-950/70 p-3 md:grid-cols-2 xl:grid-cols-4">
                <SelectFilter label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as TaskStatus | 'Todos')} options={isAdmin ? ['Todos', ...taskStatuses] : ['Todos', 'Em andamento', 'Revisão', 'Concluído']} />
                <SelectFilter label="Prioridade" value={priorityFilter} onChange={(value) => setPriorityFilter(value as TaskPriority | 'Todas')} options={['Todas', ...taskPriorities]} />
                <SelectFilter
                  label="Prazo"
                  value={periodFilter}
                  onChange={(value) => setPeriodFilter(value as PeriodFilter)}
                  options={[
                    ['all', 'Todos'],
                    ['today', 'Hoje'],
                    ['week', '7 dias'],
                    ['overdue', 'Atrasadas'],
                  ]}
                />
                <button
                  onClick={resetFilters}
                  className="h-9 self-end rounded-lg border border-slate-800 px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-200"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState onNewTask={openNewTask} />
          ) : viewMode === 'board' ? (
            <BoardView columns={isAdmin ? taskStatuses : ['Em andamento', 'Revisão', 'Concluído']} tasks={filteredTasks} onEdit={openEditTask} onDelete={deleteTask} onStatusChange={persistTaskPatch} />
          ) : viewMode === 'list' ? (
            <ListView statusOptions={isAdmin ? taskStatuses : ['Em andamento', 'Revisão', 'Concluído']} tasks={filteredTasks} onEdit={openEditTask} onDelete={deleteTask} onStatusChange={persistTaskPatch} />
          ) : (
            <CalendarView tasks={filteredTasks} onEdit={openEditTask} onDelete={deleteTask} onStatusChange={persistTaskPatch} />
          )}
        </div>

        <aside className="space-y-6 xl:col-span-3">
          <DailyQueue tasks={tasks} onEdit={openEditTask} onStatusChange={persistTaskPatch} />
          <RoutinePanel routines={routines} onComplete={completeRoutine} onDelete={deleteRoutine} onNew={openNewRoutine} />
        </aside>
      </section>

      {taskModalOpen && (
        <TaskModal
          title={editingTask ? 'Editar atividade' : 'Nova atividade'}
          draft={taskDraft}
          members={teamMembers}
          isAdmin={isAdmin}
          onChange={setTaskDraft}
          onClose={() => setTaskModalOpen(false)}
          onSave={saveTask}
        />
      )}

      {routineModalOpen && (
        <RoutineModal
          draft={routineDraft}
          members={teamMembers}
          isAdmin={isAdmin}
          onChange={setRoutineDraft}
          onClose={() => setRoutineModalOpen(false)}
          onSave={saveRoutine}
        />
      )}

      {isAdmin && memberModalOpen && (
        <MemberModal
          draft={memberDraft}
          onChange={setMemberDraft}
          onClose={() => setMemberModalOpen(false)}
          onSave={saveMember}
        />
      )}
    </div>
  );
}


function AttentionBanner({ tasks, onFocus }: { tasks: TeamTask[]; onFocus: (focus: FocusFilter) => void }) {
  const overdue = tasks.filter((task) => task.status !== 'Concluído' && isOverdue(task.dueDate));
  const high = tasks.filter((task) => task.status !== 'Concluído' && task.priority === 'Alta');
  const attention = Array.from(new Map([...overdue, ...high].map((task) => [task.id, task])).values()).slice(0, 3);

  if (!attention.length) return null;

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4 shadow-[0_0_30px_rgba(251,191,36,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
            <AlertTriangle size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-100">Pontos de atenção</p>
            <p className="mt-1 text-[11px] text-amber-100/65">{overdue.length} atrasada(s) e {high.length} de alta prioridade pedindo ação.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onFocus('overdue')} className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-400/15">Ver atrasadas</button>
          <button onClick={() => onFocus('high')} className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] font-bold text-amber-100 transition-colors hover:bg-amber-300/15">Ver alta prioridade</button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {attention.map((task) => (
          <div key={task.id} className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
            <p className="truncate text-[12px] font-semibold text-slate-100">{task.title}</p>
            <p className="mt-1 truncate text-[10px] text-slate-500">{task.owner || 'Sem responsável'} · {formatDueDate(task.dueDate)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeaderCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-900 bg-slate-950/70 px-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
      <span className="font-mono text-[12px] font-bold text-slate-200">{value}</span>
    </div>
  );
}

function FocusRail({
  active,
  isAdmin,
  counts,
  onChange,
}: {
  active: FocusFilter;
  isAdmin: boolean;
  counts: Record<FocusFilter, number>;
  onChange: (focus: FocusFilter) => void;
}) {
  const items: Array<{ id: FocusFilter; label: string; tone: string }> = [
    { id: 'all', label: 'Tudo', tone: 'text-slate-400' },
    { id: 'today', label: 'Hoje', tone: 'text-blue-300' },
    { id: 'overdue', label: 'Atrasadas', tone: 'text-rose-300' },
    { id: 'high', label: 'Alta prioridade', tone: 'text-amber-300' },
    ...(isAdmin ? [{ id: 'unassigned' as FocusFilter, label: 'Sem responsável', tone: 'text-sky-300' }] : []),
  ];

  return (
    <section className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            'flex min-w-fit items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
            active === item.id ? 'border-blue-500/30 bg-blue-500/10' : 'border-slate-900 bg-slate-950 hover:border-slate-800',
          )}
        >
          <span className={cn('text-[12px] font-semibold', active === item.id ? 'text-slate-100' : item.tone)}>{item.label}</span>
          <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{counts[item.id]}</span>
        </button>
      ))}
    </section>
  );
}

function BoardView({
  columns,
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  columns: TaskStatus[];
  tasks: TeamTask[];
  onEdit: (task: TeamTask) => void;
  onDelete: (task: TeamTask) => void;
  onStatusChange: (id: string, patch: Partial<TaskDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {columns.map((column) => (
        <div key={column} className="min-h-[360px] rounded-xl border border-slate-900 bg-slate-950/70 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-400">{column}</p>
            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              {tasks.filter((task) => task.status === column).length}
            </span>
          </div>
          <div className="space-y-3">
            {tasks
              .filter((task) => task.status === column)
              .map((task) => (
                <div key={task.id}><TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} /></div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({
  statusOptions,
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  statusOptions: TaskStatus[];
  tasks: TeamTask[];
  onEdit: (task: TeamTask) => void;
  onDelete: (task: TeamTask) => void;
  onStatusChange: (id: string, patch: Partial<TaskDraft>) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-900 custom-scrollbar">
      <div className="min-w-[760px] divide-y divide-slate-900">
        {tasks.map((task) => (
          <div key={task.id} className="grid grid-cols-[1.4fr_0.9fr_0.8fr_0.8fr_120px] items-center gap-4 px-4 py-3">
            <div>
              <button onClick={() => onEdit(task)} className="text-left text-[12px] font-semibold text-slate-200 transition-colors hover:text-blue-300">
                {task.title}
              </button>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{task.project || 'Sem projeto'}</p>
            </div>
            <span className="text-[11px] text-slate-400">{task.owner || 'Sem responsável'}</span>
            <select className={inputClass} value={task.status} onChange={(event) => onStatusChange(task.id, { status: event.target.value as TaskStatus })}>
              {statusOptions.map((status) => <option key={status}>{status}</option>)}
            </select>
            <span className={cn('w-fit rounded border px-2 py-1 text-[10px] font-bold', priorityStyles[task.priority])}>{task.priority}</span>
            <div className="flex items-center justify-end gap-1">
              <IconButton label="Editar" onClick={() => onEdit(task)}><Edit3 size={13} /></IconButton>
              <IconButton label="Excluir" onClick={() => onDelete(task)}><Trash2 size={13} /></IconButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarView({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tasks: TeamTask[];
  onEdit: (task: TeamTask) => void;
  onDelete: (task: TeamTask) => void;
  onStatusChange: (id: string, patch: Partial<TaskDraft>) => void;
}) {
  const grouped = groupByDate(tasks);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="rounded-xl border border-slate-900 bg-slate-950/70 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-400">{date}</p>
            <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{items.length}</span>
          </div>
          <div className="space-y-3">
            {items.map((task) => <div key={task.id}><TaskCard task={task} onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} /></div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: TeamTask;
  onEdit: (task: TeamTask) => void;
  onDelete: (task: TeamTask) => void;
  onStatusChange: (id: string, patch: Partial<TaskDraft>) => void;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-slate-800/80 bg-slate-900/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onEdit(task)} className="min-w-0 flex-1 break-words text-left text-[12px] font-semibold leading-5 text-slate-200 transition-colors hover:text-blue-300">
          {task.title}
        </button>
        <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold', priorityStyles[task.priority])}>{task.priority}</span>
      </div>
      <p className="mt-2 truncate text-[10px] font-medium uppercase tracking-wider text-slate-600">{task.project || 'Sem projeto'}</p>
      {task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span key={tag} className="max-w-full truncate rounded bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-500">{tag}</span>
          ))}
        </div>
      )}
      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="min-w-0 truncate">{task.owner || 'Sem responsável'}</span>
        <span className="inline-flex shrink-0 items-center gap-1"><Clock3 size={11} />{formatDueDate(task.dueDate)}</span>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_32px_32px] items-center gap-2">
        <button
          onClick={() => onStatusChange(task.id, { status: getNextStatus(task.status) })}
          className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-bold text-slate-400 transition-colors hover:text-slate-100"
        >
          <ArrowRight size={12} className="shrink-0" />
          <span className="truncate">{getNextActionLabel(task.status)}</span>
        </button>
        <IconButton label="Editar" onClick={() => onEdit(task)}><Edit3 size={13} /></IconButton>
        <IconButton label="Excluir" onClick={() => onDelete(task)}><Trash2 size={13} /></IconButton>
      </div>
    </article>
  );
}


function DailyQueue({
  tasks,
  onEdit,
  onStatusChange,
}: {
  tasks: TeamTask[];
  onEdit: (task: TeamTask) => void;
  onStatusChange: (id: string, patch: Partial<TaskDraft>) => void;
}) {
  const queue = tasks
    .filter((task) => task.status !== 'Concluído' && (matchesPeriodFilter(task.dueDate, 'overdue') || matchesPeriodFilter(task.dueDate, 'today') || task.priority === 'Alta'))
    .sort((first, second) => getTaskUrgency(second) - getTaskUrgency(first))
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Fila do dia</h2>
          <p className="mt-1 text-[11px] text-slate-500">O que merece atenção primeiro.</p>
        </div>
        <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{queue.length}</span>
      </div>
      <div className="mt-5 space-y-3">
        {queue.length ? queue.map((task) => (
          <div key={task.id} className="rounded-lg border border-slate-900 bg-slate-950/70 p-3">
            <button onClick={() => onEdit(task)} className="text-left text-[12px] font-semibold leading-5 text-slate-200 transition-colors hover:text-blue-300">
              {task.title}
            </button>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-600">
              <span>{task.owner || 'Sem responsável'}</span>
              <span>{formatDueDate(task.dueDate)}</span>
            </div>
            <button
              onClick={() => onStatusChange(task.id, { status: getNextStatus(task.status) })}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 text-[10px] font-bold text-slate-400 transition-colors hover:text-slate-100"
            >
              <ArrowRight size={12} />
              {getNextActionLabel(task.status)}
            </button>
          </div>
        )) : (
          <p className="rounded-lg border border-slate-900 bg-slate-950/70 p-3 text-[11px] text-slate-500">Nada urgente por aqui.</p>
        )}
      </div>
    </div>
  );
}


function RoutinePanel({
  routines,
  onComplete,
  onDelete,
  onNew,
}: {
  routines: TeamRoutine[];
  onComplete: (routine: TeamRoutine) => void;
  onDelete: (routine: TeamRoutine) => void;
  onNew: () => void;
}) {
  const visibleRoutines = routines
    .filter((routine) => routine.active !== false && isRoutineDueToday(routine) && !isRoutineCompletedForCurrentOccurrence(routine))
    .sort((first, second) => getRoutineSortValue(first) - getRoutineSortValue(second))
    .slice(0, 8);

  return (
    <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Rotinas de hoje</h2>
          <p className="mt-1 text-[11px] text-slate-500">Marque aqui quando fizer.</p>
        </div>
        <button onClick={onNew} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500" aria-label="Adicionar rotina" title="Adicionar rotina">
          <Plus size={14} />
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {visibleRoutines.length ? visibleRoutines.map((routine) => (
          <div key={routine.id} className="rounded-lg border border-slate-900 bg-slate-950/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[12px] font-semibold leading-5 text-slate-200">{routine.title}</p>
                <p className="mt-1 text-[10px] text-slate-600">{routine.owner || 'Sem responsável'} · {formatRoutineSchedule(routine)}</p>
              </div>
              <IconButton label="Excluir rotina" onClick={() => onDelete(routine)}><Trash2 size={13} /></IconButton>
            </div>
            <button onClick={() => onComplete(routine)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/15">
              <CheckCircle2 size={13} />
              Concluir rotina
            </button>
          </div>
        )) : (
          <p className="rounded-lg border border-slate-900 bg-slate-950/70 p-3 text-[11px] text-slate-500">Nenhuma rotina pendente para hoje.</p>
        )}
      </div>
    </div>
  );
}

function TaskModal({
  title,
  draft,
  members,
  isAdmin,
  onChange,
  onClose,
  onSave,
}: {
  title: string;
  draft: TaskDraft;
  members: TeamMember[];
  isAdmin: boolean;
  onChange: (draft: TaskDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Título" className="md:col-span-2"><input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} autoFocus /></Field>
        <Field label="Projeto"><input className={inputClass} value={draft.project} onChange={(event) => onChange({ ...draft, project: event.target.value })} /></Field>
        <Field label="Responsável">
          {isAdmin ? (
            <select
              className={inputClass}
              value={draft.ownerEmail}
              onChange={(event) => {
                const member = members.find((item) => item.email === event.target.value);
                onChange({ ...draft, owner: member?.name ?? '', ownerEmail: member?.email ?? '' });
              }}
            >
              <option value="">Sem responsável</option>
              {members.map((member) => <option key={member.id} value={member.email}>{member.name}</option>)}
            </select>
          ) : (
            <input className={inputClass} value={draft.owner || 'Você'} readOnly />
          )}
        </Field>
        <Field label="Status"><select className={inputClass} value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as TaskStatus })}>{(isAdmin ? taskStatuses : ['Em andamento', 'Revisão', 'Concluído']).map((status) => <option key={status}>{status}</option>)}</select></Field>
        <Field label="Prioridade"><select className={inputClass} value={draft.priority} onChange={(event) => onChange({ ...draft, priority: event.target.value as TaskPriority })}>{taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></Field>
        <Field label="Prazo"><input className={inputClass} type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })} /></Field>
        <Field label="Esforço"><input className={inputClass} placeholder="Ex: 3h" value={draft.effort} onChange={(event) => onChange({ ...draft, effort: event.target.value })} /></Field>
        <Field label="Tags" className="md:col-span-2"><input className={inputClass} placeholder="Marketing, Copy, Dados" value={draft.tags.join(', ')} onChange={(event) => onChange({ ...draft, tags: parseTags(event.target.value) })} /></Field>
        <Field label="Observações" className="md:col-span-2"><textarea className={cn(inputClass, 'h-24 py-2')} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={onSave} saveLabel="Salvar atividade" disabled={!draft.title.trim()} />
    </Modal>
  );
}


function RoutineModal({
  draft,
  members,
  isAdmin,
  onChange,
  onClose,
  onSave,
}: {
  draft: RoutineDraft;
  members: TeamMember[];
  isAdmin: boolean;
  onChange: (draft: RoutineDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title="Nova rotina" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Título" className="md:col-span-2"><input className={inputClass} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} autoFocus /></Field>
        <Field label="Projeto"><input className={inputClass} value={draft.project} onChange={(event) => onChange({ ...draft, project: event.target.value })} /></Field>
        <Field label="Responsável">
          {isAdmin ? (
            <select
              className={inputClass}
              value={draft.ownerEmail}
              onChange={(event) => {
                const member = members.find((item) => item.email === event.target.value);
                onChange({ ...draft, owner: member?.name ?? '', ownerEmail: member?.email ?? '' });
              }}
            >
              <option value="">Sem responsável</option>
              {members.map((member) => <option key={member.id} value={member.email}>{member.name}</option>)}
            </select>
          ) : (
            <input className={inputClass} value={draft.owner || 'Você'} readOnly />
          )}
        </Field>
        <Field label="Frequência"><select className={inputClass} value={draft.frequency} onChange={(event) => onChange({ ...draft, frequency: event.target.value as RoutineFrequency })}><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option></select></Field>
        {draft.frequency === 'weekly' ? (
          <Field label="Dia da semana"><select className={inputClass} value={draft.weekdays[0] ?? new Date().getDay()} onChange={(event) => onChange({ ...draft, weekdays: [Number(event.target.value)] })}>{weekdayOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
        ) : (
          <Field label="Data inicial"><input className={inputClass} type="date" value={draft.startDate} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} /></Field>
        )}
        <Field label="Horário"><input className={inputClass} type="time" value={draft.time} onChange={(event) => onChange({ ...draft, time: event.target.value })} /></Field>
        <Field label="Prioridade"><select className={inputClass} value={draft.priority} onChange={(event) => onChange({ ...draft, priority: event.target.value as TaskPriority })}>{taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></Field>
        <Field label="Tags" className="md:col-span-2"><input className={inputClass} placeholder="Rotina, Operação, Atendimento" value={draft.tags.join(', ')} onChange={(event) => onChange({ ...draft, tags: parseTags(event.target.value) })} /></Field>
        <Field label="Observações" className="md:col-span-2"><textarea className={cn(inputClass, 'h-24 py-2')} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={onSave} saveLabel="Salvar rotina" disabled={!draft.title.trim()} />
    </Modal>
  );
}

function MemberModal({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: MemberDraft;
  onChange: (draft: MemberDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal title="Adicionar membro" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome"><input className={inputClass} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} autoFocus /></Field>
        <Field label="Função"><input className={inputClass} value={draft.role} onChange={(event) => onChange({ ...draft, role: event.target.value })} /></Field>
        <Field label="E-mail"><input className={inputClass} type="email" value={draft.email} onChange={(event) => onChange({ ...draft, email: event.target.value })} /></Field>
      </div>
      <ModalActions onClose={onClose} onSave={onSave} saveLabel="Salvar membro" disabled={!draft.name.trim() || !draft.email.trim()} />
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <IconButton label="Fechar" onClick={onClose}><X size={14} /></IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, onSave, saveLabel, disabled }: { onClose: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onClose} className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100">Cancelar</button>
      <button onClick={onSave} disabled={disabled} className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">{saveLabel}</button>
    </div>
  );
}

function ViewSwitcher({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const options: Array<{ id: ViewMode; label: string; icon: typeof LayoutGrid }> = [
    { id: 'board', label: 'Quadro', icon: LayoutGrid },
    { id: 'list', label: 'Lista', icon: List },
    { id: 'calendar', label: 'Prazos', icon: CalendarDays },
  ];

  return (
    <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn('inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors', value === option.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-200')}
          >
            <Icon size={13} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<string | [string, string]> }) {
  return (
    <label className="space-y-2">
      <span className={labelClass}>{label}</span>
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={cn('space-y-2', className)}><span className={labelClass}>{label}</span>{children}</label>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:text-slate-200">{children}</button>;
}

function EmptyState({ onNewTask }: { onNewTask: () => void }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-950/60 text-center">
      <p className="text-sm font-semibold text-slate-300">Nenhuma atividade encontrada</p>
      <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-600">Crie uma atividade ou limpe os filtros para voltar a visualizar a operação.</p>
      <button onClick={onNewTask} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500">
        <Plus size={13} />
        Nova atividade
      </button>
    </div>
  );
}

function normalizeTaskDraft(draft: TaskDraft, members: TeamMember[], profile: UserProfile): TaskDraft {
  if (profile.role !== 'admin') {
    return {
      ...draft,
      owner: profile.name,
      ownerEmail: profile.email,
      status: draft.status === 'Backlog' ? 'Em andamento' : draft.status,
    };
  }

  const member = members.find((item) => item.email === draft.ownerEmail || item.name === draft.owner);
  return {
    ...draft,
    owner: member?.name ?? draft.owner,
    ownerEmail: member?.email ?? draft.ownerEmail,
  };
}


function normalizeRoutineDraft(draft: RoutineDraft, members: TeamMember[], profile: UserProfile): RoutineDraft {
  if (profile.role !== 'admin') {
    return {
      ...draft,
      owner: profile.name,
      ownerEmail: profile.email,
    };
  }

  const member = members.find((item) => item.email === draft.ownerEmail || item.name === draft.owner);
  return {
    ...draft,
    owner: member?.name ?? draft.owner,
    ownerEmail: member?.email ?? draft.ownerEmail,
  };
}

function isRoutineDueToday(routine: TeamRoutine) {
  if (routine.active === false) return false;

  const today = startOfDay(new Date());
  const start = startOfDay(new Date(`${routine.startDate || toLocalDateInputValue(today)}T00:00:00`));
  if (start > today) return false;

  if (routine.frequency === 'weekly') {
    return getRoutineWeekday(routine) === today.getDay();
  }

  return true;
}

function isRoutineCompletedForCurrentOccurrence(routine: TeamRoutine) {
  return (routine.completedOccurrences ?? []).includes(getRoutineOccurrenceKey(routine));
}

function getRoutineOccurrenceKey(routine: TeamRoutine) {
  return `${routine.id}:${toLocalDateInputValue(new Date())}`;
}

function getRoutineNextDate(routine: Pick<TeamRoutine, 'startDate' | 'frequency' | 'weekdays'>) {
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(`${routine.startDate || toLocalDateInputValue(today)}T00:00:00`));

  if (routine.frequency !== 'weekly') {
    return toLocalDateInputValue(start > today ? start : today);
  }

  const targetDay = getRoutineWeekday(routine);
  const base = start > today ? start : today;
  const next = new Date(base);
  const daysUntil = (targetDay - base.getDay() + 7) % 7;
  next.setDate(base.getDate() + daysUntil);
  return toLocalDateInputValue(next);
}

function getRoutineWeekday(routine: Pick<TeamRoutine, 'startDate' | 'weekdays'>) {
  if (routine.weekdays?.length) return routine.weekdays[0];
  if (routine.startDate) return new Date(`${routine.startDate}T00:00:00`).getDay();
  return new Date().getDay();
}

function getRoutineSortValue(routine: TeamRoutine) {
  const nextDate = getRoutineNextDate(routine);
  return new Date(`${nextDate}T${routine.time || '23:59'}:00`).getTime();
}

function formatRoutineSchedule(routine: TeamRoutine) {
  if (routine.frequency === 'weekly') {
    const weekday = weekdayOptions.find((option) => option.value === getRoutineWeekday(routine))?.label ?? 'Sem dia';
    return `${weekday}, ${routine.time || '--:--'}`;
  }

  return `diária às ${routine.time || '--:--'}`;
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTags(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'erro desconhecido';
}

function matchesPeriodFilter(dueDate: string, filter: PeriodFilter) {
  if (filter === 'all') return true;
  if (!dueDate) return false;

  const today = startOfDay(new Date());
  const date = startOfDay(new Date(`${dueDate}T00:00:00`));
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);

  if (filter === 'today') return diffDays === 0;
  if (filter === 'week') return diffDays >= 0 && diffDays <= 7;
  return diffDays < 0;
}

function isOverdue(dueDate: string) {
  return matchesPeriodFilter(dueDate, 'overdue');
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDueDate(dueDate: string) {
  if (!dueDate) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${dueDate}T00:00:00`));
}


function getNextStatus(status: TaskStatus): TaskStatus {
  if (status === 'Backlog') return 'Em andamento';
  if (status === 'Em andamento') return 'Revisão';
  if (status === 'Revisão') return 'Concluído';
  return 'Concluído';
}

function getNextActionLabel(status: TaskStatus) {
  if (status === 'Backlog') return 'Começar';
  if (status === 'Em andamento') return 'Enviar revisão';
  if (status === 'Revisão') return 'Concluir';
  return 'Concluída';
}

function getTaskUrgency(task: TeamTask) {
  let score = 0;
  if (task.priority === 'Alta') score += 3;
  if (matchesPeriodFilter(task.dueDate, 'today')) score += 4;
  if (matchesPeriodFilter(task.dueDate, 'overdue')) score += 6;
  if (!task.owner) score += 1;
  return score;
}

function groupByDate(tasks: TeamTask[]) {
  return tasks.reduce<Record<string, TeamTask[]>>((groups, task) => {
    const key = task.dueDate ? formatDueDate(task.dueDate) : 'Sem prazo';
    groups[key] = [...(groups[key] ?? []), task];
    return groups;
  }, {});
}
