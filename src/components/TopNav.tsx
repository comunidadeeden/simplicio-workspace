import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Clock3, LogOut, Moon, Sun, User } from 'lucide-react';
import { logout, type UserProfile } from '../lib/auth';
import { subscribeUserActivityNotifications, type TeamTask } from '../lib/activities';
import { cn } from '../lib/utils';

type TopNavProps = {
  userProfile: UserProfile;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
};

export function TopNav({ userProfile, theme, onToggleTheme }: TopNavProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tasks, setTasks] = useState<TeamTask[]>([]);

  useEffect(() => {
    return subscribeUserActivityNotifications(userProfile, setTasks, () => setTasks([]));
  }, [userProfile]);

  const notifications = useMemo(() => tasks
    .filter((task) => task.status !== 'Concluído')
    .sort((first, second) => getNotificationPriority(second) - getNotificationPriority(first))
    .slice(0, 8), [tasks]);

  const urgentCount = notifications.filter((task) => task.priority === 'Alta' || isOverdue(task.dueDate) || isToday(task.dueDate)).length;

  return (
    <header className="h-16 px-10 flex items-center justify-end border-b border-slate-900/50 bg-slate-950/20 backdrop-blur-sm sticky top-0 z-10 w-full">
      <div className="flex items-center gap-3 ml-4">
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 transition-colors hover:border-blue-500/50 hover:text-slate-100"
          title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen((value) => !value)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-500 transition-colors hover:text-slate-200"
            aria-label="Notificações"
            title="Notificações"
          >
            <Bell className="h-4 w-4" />
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[9px] font-bold text-white ring-2 ring-slate-950">
                {notifications.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-[340px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-2xl shadow-black/30">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[12px] font-semibold text-slate-100">Minhas notificações</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">Atividades atribuídas a você</p>
                </div>
                <span className={cn('rounded border px-2 py-1 font-mono text-[10px] font-bold', urgentCount ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>
                  {urgentCount} alerta(s)
                </span>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto custom-scrollbar">
                {notifications.length ? notifications.map((task) => (
                  <div key={task.id} className="rounded-xl border border-slate-900 bg-slate-950/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[12px] font-semibold leading-5 text-slate-200">{task.title}</p>
                      <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold', task.priority === 'Alta' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : task.priority === 'Média' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>{task.priority}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-600">
                      <span>{task.status}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 size={11} />{formatDueDate(task.dueDate)}</span>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-slate-900 bg-slate-950/70 p-4 text-center">
                    <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400" />
                    <p className="mt-2 text-[12px] font-semibold text-slate-200">Nada pendente agora</p>
                    <p className="mt-1 text-[10px] text-slate-600">Suas atividades abertas aparecerão aqui.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 pl-5 border-l border-slate-900">
          <div className="text-right hidden sm:block">
            <p className="text-[12px] font-semibold text-slate-200 tracking-tight">{userProfile.name}</p>
            <p className="text-[10px] text-slate-600 font-medium">{userProfile.role === 'admin' ? 'Admin' : 'Colaborador'}</p>
          </div>
          <div className="h-8 w-8 overflow-hidden rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shadow-sm">
            {userProfile.photoURL ? <img src={userProfile.photoURL} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4 text-slate-400" />}
          </div>
          <button onClick={logout} className="p-2 text-slate-500 transition-colors hover:text-slate-200" title="Sair" aria-label="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

function getNotificationPriority(task: TeamTask) {
  let score = 0;
  if (task.priority === 'Alta') score += 5;
  if (isOverdue(task.dueDate)) score += 6;
  if (isToday(task.dueDate)) score += 4;
  if (task.status === 'Revisão') score += 2;
  return score;
}

function isToday(date: string) {
  if (!date) return false;
  return date === new Date().toISOString().slice(0, 10);
}

function isOverdue(date: string) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`) < today;
}

function formatDueDate(date: string) {
  if (!date) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}
