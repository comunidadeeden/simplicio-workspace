import { useEffect, useMemo, useState } from 'react';
import { Check, Mail, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import {
  ADMIN_PERMISSIONS,
  DEFAULT_COLLABORATOR_PERMISSIONS,
  addAllowedUser,
  isAdminEmail,
  removeAllowedUser,
  subscribeAllowedUsers,
  updateAllowedUser,
  type AllowedUser,
  type AppPage,
} from '../lib/auth';
import { cn } from '../lib/utils';

const pageOptions: Array<{ id: AppPage; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'activities', label: 'Atividades' },
  { id: 'finance', label: 'Financeiro' },
  { id: 'launches', label: 'Lançamentos' },
  { id: 'leads', label: 'Leads' },
];

const inputClass = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';

export function Team() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeAllowedUsers(setUsers), []);

  const selected = useMemo(() => users.find((user) => user.email === selectedEmail) ?? users.find((user) => !isAdminEmail(user.email)) ?? users[0], [selectedEmail, users]);

  useEffect(() => {
    if (selected && !selectedEmail) setSelectedEmail(selected.email);
  }, [selected, selectedEmail]);



  const createMember = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await addAllowedUser(email, name, 'collaborator', DEFAULT_COLLABORATOR_PERMISSIONS);
      setName('');
      setEmail('');
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (user: AllowedUser, page: AppPage) => {
    if (isAdminEmail(user.email)) return;
    const current = new Set(user.permissions);
    if (current.has(page)) current.delete(page);
    else current.add(page);
    current.add('dashboard');
    current.add('activities');
    await updateAllowedUser(user.email, { permissions: Array.from(current) });
  };

  const toggleActive = async (user: AllowedUser) => {
    if (isAdminEmail(user.email)) return;
    await updateAllowedUser(user.email, { active: !user.active });
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-10 text-slate-300">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Controle de acesso</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Equipe</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">Gerencie membros e permissões por aba. Para acompanhar tarefas por pessoa, use o filtro de responsável em Atividades.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <aside className="space-y-4 xl:col-span-4">
          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserPlus size={15} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-200">Adicionar membro</h2>
            </div>
            <div className="grid gap-3">
              <label className="space-y-2"><span className={labelClass}>Nome</span><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do colaborador" /></label>
              <label className="space-y-2"><span className={labelClass}>E-mail</span><input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@dominio.com" /></label>
              <button onClick={createMember} disabled={saving || !email.trim()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
                <UserPlus size={13} />
                Adicionar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Users size={15} className="text-blue-400" /><h2 className="text-sm font-semibold text-slate-200">Membros</h2></div>
              <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{users.length}</span>
            </div>
            <div className="space-y-2">
              {users.map((user) => {
                const selectedItem = selected?.email === user.email;
                return (
                  <button key={user.email} onClick={() => setSelectedEmail(user.email)} className={cn('w-full rounded-xl border p-3 text-left transition-colors', selectedItem ? 'border-blue-500/40 bg-blue-500/10' : 'border-slate-900 bg-slate-950/70 hover:border-slate-800')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-200">{user.name || user.email}</p>
                        <p className="mt-1 truncate text-[10px] text-slate-600">{user.email}</p>
                      </div>
                      <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold', user.active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/20 bg-rose-500/10 text-rose-300')}>{user.active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="space-y-6 xl:col-span-8">
          {selected ? (
            <>
              <section className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Membro selecionado</p>
                    <h2 className="mt-2 text-lg font-display font-bold text-slate-100">{selected.name || selected.email}</h2>
                    <p className="mt-1 inline-flex items-center gap-2 text-[11px] text-slate-500"><Mail size={12} />{selected.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isAdminEmail(selected.email) && <button onClick={() => toggleActive(selected)} className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100">{selected.active ? 'Desativar' : 'Ativar'}</button>}
                    {!isAdminEmail(selected.email) && <button onClick={() => removeAllowedUser(selected.email)} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/20 px-3 py-2 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/10"><Trash2 size={13} />Remover</button>}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pageOptions.map((page) => {
                    const enabled = isAdminEmail(selected.email) || selected.permissions.includes(page.id);
                    return (
                      <button key={page.id} disabled={isAdminEmail(selected.email)} onClick={() => togglePermission(selected, page.id)} className={cn('flex items-center justify-between rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed', enabled ? 'border-blue-500/30 bg-blue-500/10' : 'border-slate-900 bg-slate-950/70 hover:border-slate-800')}>
                        <span className="text-[12px] font-semibold text-slate-200">{page.label}</span>
                        <span className={cn('flex h-5 w-5 items-center justify-center rounded border', enabled ? 'border-blue-500/40 bg-blue-600 text-white' : 'border-slate-800 text-slate-700')}>
                          {enabled && <Check size={12} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-slate-900/50 bg-slate-950 p-8 text-center">
              <Shield className="mx-auto h-6 w-6 text-blue-400" />
              <p className="mt-3 text-sm font-semibold text-slate-200">Nenhum membro encontrado</p>
              <p className="mt-1 text-[11px] text-slate-500">Adicione o primeiro colaborador para começar a gerenciar acessos.</p>
            </section>
          )}
        </main>
      </section>
    </div>
  );
}
