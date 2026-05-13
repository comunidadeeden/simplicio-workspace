import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  CheckCircle2,
  Copy,
  Link,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sheet,
  Trash2,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { addAllowedUser, removeAllowedUser, subscribeAllowedUsers, type AllowedUser, type UserProfile } from '../lib/auth';
import {
  defaultIntegrationSettings,
  loadSheetData,
  saveIntegrationSettings,
  subscribeIntegrationSettings,
  toCsvUrl,
  type AdAccountConfig,
  type ConnectionStatus,
  type IntegrationSettings,
} from '../lib/integrations';
import { cn } from '../lib/utils';

const statusStyles: Record<ConnectionStatus, string> = {
  Ativa: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  Pendente: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  Erro: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

const inputClass =
  'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';

export function Settings({ userProfile }: { userProfile: UserProfile }) {
  const [settings, setSettings] = useState<IntegrationSettings>(defaultIntegrationSettings);
  const [draftAccount, setDraftAccount] = useState({
    name: '',
    platform: 'Meta Ads',
    accountId: '',
    spreadsheetUrl: '',
    sheetName: 'Página 1',
    gid: '0',
  });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testState, setTestState] = useState<'idle' | 'testing'>('idle');
  const [testMessage, setTestMessage] = useState('As planilhas serão lidas via exportação CSV pública.');
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [accessDraft, setAccessDraft] = useState({ name: '', email: '' });

  const activeConnections = settings.adAccounts.filter((account) => account.status === 'Ativa').length + (settings.sales.status === 'Ativa' ? 1 : 0);

  useEffect(() => {
    return subscribeIntegrationSettings(setSettings, () => setSettings(defaultIntegrationSettings));
  }, []);

  useEffect(() => {
    if (userProfile.role !== 'admin') return;
    return subscribeAllowedUsers(setAllowedUsers);
  }, [userProfile.role]);

  const updateSales = (patch: Partial<IntegrationSettings['sales']>) => {
    setSettings((current) => ({ ...current, sales: { ...current.sales, ...patch } }));
  };

  const updateWebhook = (patch: Partial<IntegrationSettings['webhook']>) => {
    setSettings((current) => ({ ...current, webhook: { ...current.webhook, ...patch } }));
  };

  const updateAdAccount = (id: string, patch: Partial<AdAccountConfig>) => {
    setSettings((current) => ({
      ...current,
      adAccounts: current.adAccounts.map((account) => (account.id === id ? { ...account, ...patch } : account)),
    }));
  };

  const addAccess = async () => {
    if (!accessDraft.email.trim()) return;
    await addAllowedUser(accessDraft.email, accessDraft.name);
    setAccessDraft({ name: '', email: '' });
  };

  const addAdAccount = () => {
    if (!draftAccount.name.trim() || !draftAccount.spreadsheetUrl.trim()) return;

    setSettings((current) => ({
      ...current,
      adAccounts: [
        ...current.adAccounts,
        {
          id: `${draftAccount.platform}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: draftAccount.name.trim(),
          platform: draftAccount.platform,
          accountId: draftAccount.accountId,
          spreadsheetUrl: draftAccount.spreadsheetUrl,
          sheetName: draftAccount.sheetName,
          gid: draftAccount.gid,
          dateColumn: 'data',
          spendColumn: 'valor gasto',
          campaignColumn: 'campanha',
          status: 'Ativa',
        },
      ],
    }));
    setDraftAccount({ name: '', platform: 'Meta Ads', accountId: '', spreadsheetUrl: '', sheetName: 'Página 1', gid: '0' });
  };

  const removeAdAccount = (id: string) => {
    setSettings((current) => ({ ...current, adAccounts: current.adAccounts.filter((account) => account.id !== id) }));
  };

  const save = async () => {
    setSaveState('saving');
    try {
      await saveIntegrationSettings(settings);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } catch (error) {
      console.error('Failed to save integration settings.', error);
      setSaveState('error');
    }
  };

  const testSheets = async () => {
    setTestState('testing');
    const result = await loadSheetData(settings);
    setTestState('idle');
    if (result.errors.length) {
      setTestMessage(`Leitura parcial: ${result.sales.length} vendas, ${result.traffic.length} linhas de tráfego. Pendências: ${result.errors.join(' | ')}`);
      return;
    }
    setTestMessage(`Leitura OK: ${result.sales.length} vendas e ${result.traffic.length} linhas de tráfego importadas.`);
  };

  return (
    <div className="mx-auto max-w-[1450px] space-y-6 p-10 text-slate-300">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Dados e automações</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Configurações</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
            Conecte vendas, contas de anúncio e webhook para alimentar os dashboards com dados reais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status="Ativa" label={`${activeConnections} conexões ativas`} />
          <button
            onClick={testSheets}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:text-white"
          >
            <RefreshCw size={13} className={cn(testState === 'testing' && 'animate-spin')} />
            Testar planilhas
          </button>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500"
          >
            {saveState === 'saved' ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saveState === 'saving' ? 'Salvando' : saveState === 'saved' ? 'Salvo' : saveState === 'error' ? 'Erro' : 'Salvar'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Vendas', value: settings.sales.platform, detail: settings.sales.sheetName, icon: Sheet },
          { label: 'Contas de anúncios', value: settings.adAccounts.length, detail: `${settings.adAccounts.filter((account) => account.status === 'Ativa').length} ativas`, icon: Megaphone },
          { label: 'Webhook', value: settings.webhook.cadence, detail: settings.webhook.name, icon: Webhook },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{item.label}</p>
                  <p className="mt-2 font-mono text-base font-bold tracking-tighter text-slate-100">{item.value}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-600">{item.detail}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400">
                  <Icon size={15} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 text-[12px] leading-5 text-amber-200">
        {testMessage}
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <SettingsPanel icon={Sheet} title="Planilha de vendas" description="Fonte principal de faturamento, pedidos e ticket médio.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Plataforma"><input className={inputClass} value={settings.sales.platform} onChange={(event) => updateSales({ platform: event.target.value })} /></Field>
              <Field label="Aba"><input className={inputClass} value={settings.sales.sheetName} onChange={(event) => updateSales({ sheetName: event.target.value })} /></Field>
              <Field label="GID"><input className={inputClass} value={settings.sales.gid} onChange={(event) => updateSales({ gid: event.target.value })} /></Field>
              <Field label="Coluna data"><input className={inputClass} value={settings.sales.dateColumn} onChange={(event) => updateSales({ dateColumn: event.target.value })} /></Field>
              <Field label="Coluna receita"><input className={inputClass} value={settings.sales.revenueColumn} onChange={(event) => updateSales({ revenueColumn: event.target.value })} /></Field>
              <Field label="Coluna pedido"><input className={inputClass} value={settings.sales.orderColumn} onChange={(event) => updateSales({ orderColumn: event.target.value })} placeholder="opcional" /></Field>
              <Field label="Coluna produto"><input className={inputClass} value={settings.sales.productColumn} onChange={(event) => updateSales({ productColumn: event.target.value })} /></Field>
              <Field label="Coluna status"><input className={inputClass} value={settings.sales.statusColumn} onChange={(event) => updateSales({ statusColumn: event.target.value })} /></Field>
              <Field label="Status"><select className={inputClass} value={settings.sales.status} onChange={(event) => updateSales({ status: event.target.value as ConnectionStatus })}><option>Ativa</option><option>Pendente</option><option>Erro</option></select></Field>
            </div>
            <Field label="URL da planilha">
              <UrlField value={settings.sales.spreadsheetUrl} onChange={(value) => updateSales({ spreadsheetUrl: value })} />
            </Field>
            <p className="rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 font-mono text-[10px] text-slate-500">CSV: {toCsvUrl(settings.sales.spreadsheetUrl, settings.sales.gid)}</p>
          </SettingsPanel>

          <SettingsPanel icon={Megaphone} title="Contas de anúncios" description="Cada conta alimenta o financeiro com gasto + imposto de tráfego.">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <input className={inputClass} placeholder="Nome" value={draftAccount.name} onChange={(event) => setDraftAccount({ ...draftAccount, name: event.target.value })} />
              <select className={inputClass} value={draftAccount.platform} onChange={(event) => setDraftAccount({ ...draftAccount, platform: event.target.value })}><option>Meta Ads</option><option>Google Ads</option><option>TikTok Ads</option><option>LinkedIn Ads</option></select>
              <input className={inputClass} placeholder="ID da conta" value={draftAccount.accountId} onChange={(event) => setDraftAccount({ ...draftAccount, accountId: event.target.value })} />
              <input className={inputClass} placeholder="GID" value={draftAccount.gid} onChange={(event) => setDraftAccount({ ...draftAccount, gid: event.target.value })} />
              <input className={cn(inputClass, 'lg:col-span-1')} placeholder="URL da planilha" value={draftAccount.spreadsheetUrl} onChange={(event) => setDraftAccount({ ...draftAccount, spreadsheetUrl: event.target.value })} />
              <button onClick={addAdAccount} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 text-[11px] font-bold text-slate-300 transition-colors hover:text-white"><Plus size={13} />Adicionar</button>
            </div>

            <div className="space-y-3">
              {settings.adAccounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-slate-900 bg-slate-950/70 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-slate-300">{account.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{account.platform} · {account.accountId || 'Sem ID'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={account.status} label={account.status} />
                      <button onClick={() => removeAdAccount(account.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900 hover:text-rose-300" aria-label={`Remover ${account.name}`} title="Remover conta"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Field label="Nome"><input className={inputClass} value={account.name} onChange={(event) => updateAdAccount(account.id, { name: event.target.value })} /></Field>
                    <Field label="Plataforma"><input className={inputClass} value={account.platform} onChange={(event) => updateAdAccount(account.id, { platform: event.target.value })} /></Field>
                    <Field label="Status"><select className={inputClass} value={account.status} onChange={(event) => updateAdAccount(account.id, { status: event.target.value as ConnectionStatus })}><option>Ativa</option><option>Pendente</option><option>Erro</option></select></Field>
                    <Field label="Coluna data"><input className={inputClass} value={account.dateColumn} onChange={(event) => updateAdAccount(account.id, { dateColumn: event.target.value })} /></Field>
                    <Field label="Coluna gasto"><input className={inputClass} value={account.spendColumn} onChange={(event) => updateAdAccount(account.id, { spendColumn: event.target.value })} /></Field>
                    <Field label="Coluna campanha"><input className={inputClass} value={account.campaignColumn} onChange={(event) => updateAdAccount(account.id, { campaignColumn: event.target.value })} /></Field>
                    <Field label="GID"><input className={inputClass} value={account.gid} onChange={(event) => updateAdAccount(account.id, { gid: event.target.value })} /></Field>
                    <Field label="Aba"><input className={inputClass} value={account.sheetName} onChange={(event) => updateAdAccount(account.id, { sheetName: event.target.value })} /></Field>
                    <Field label="ID conta"><input className={inputClass} value={account.accountId} onChange={(event) => updateAdAccount(account.id, { accountId: event.target.value })} /></Field>
                  </div>
                  <div className="mt-3"><UrlField value={account.spreadsheetUrl} onChange={(value) => updateAdAccount(account.id, { spreadsheetUrl: value })} /></div>
                </div>
              ))}
            </div>
          </SettingsPanel>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          {userProfile.role === 'admin' && (
            <SettingsPanel icon={Settings2} title="Acessos" description="Adicione pessoas que podem entrar com Google.">
              <div className="grid grid-cols-1 gap-3">
                <input className={inputClass} placeholder="Nome" value={accessDraft.name} onChange={(event) => setAccessDraft({ ...accessDraft, name: event.target.value })} />
                <input className={inputClass} type="email" placeholder="email@empresa.com" value={accessDraft.email} onChange={(event) => setAccessDraft({ ...accessDraft, email: event.target.value })} />
                <button onClick={addAccess} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 text-[11px] font-bold text-slate-300 transition-colors hover:text-white"><Plus size={13} />Liberar acesso</button>
              </div>
              <div className="space-y-2">
                {allowedUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2">
                    <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-slate-300">{user.name || user.email}</p><p className="truncate text-[10px] text-slate-600">{user.email} · {user.role === 'admin' ? 'Admin' : 'Colaborador'}</p></div>
                    {user.role !== 'admin' && <button onClick={() => removeAllowedUser(user.email)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900 hover:text-rose-300" aria-label={`Remover ${user.email}`} title="Remover acesso"><Trash2 size={14} /></button>}
                  </div>
                ))}
              </div>
            </SettingsPanel>
          )}

          <SettingsPanel icon={Webhook} title="Webhook da equipe" description="Automação para enviar atividades abertas no WhatsApp.">
            <Field label="Nome"><input className={inputClass} value={settings.webhook.name} onChange={(event) => updateWebhook({ name: event.target.value })} /></Field>
            <Field label="URL"><input className={inputClass} value={settings.webhook.url} onChange={(event) => updateWebhook({ url: event.target.value })} /></Field>
            <Field label="Envio"><select className={inputClass} value={settings.webhook.cadence} onChange={(event) => updateWebhook({ cadence: event.target.value })}><option>Diário às 08:30</option><option>Diário às 18:00</option><option>Segunda, quarta e sexta</option><option>Manual</option></select></Field>
            <div className="space-y-3">
              <Toggle label="Responsáveis" checked={settings.webhook.includeOwners} onChange={() => updateWebhook({ includeOwners: !settings.webhook.includeOwners })} />
              <Toggle label="Prazos" checked={settings.webhook.includeDueDates} onChange={() => updateWebhook({ includeDueDates: !settings.webhook.includeDueDates })} />
            </div>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[11px] font-bold text-blue-300 transition-colors hover:text-blue-100"><BellRing size={13} />Testar webhook</button>
          </SettingsPanel>

          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Settings2 size={16} /></div><div><h2 className="text-sm font-semibold text-slate-200">Campos esperados</h2><p className="text-[11px] text-slate-500">Você pode mudar os nomes acima.</p></div></div>
            <div className="mt-5 space-y-2">
              {['data', 'valor', 'produto', 'valor gasto', 'campanha', 'status'].map((field) => <div key={field} className="flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2"><span className="font-mono text-[11px] text-slate-400">{field}</span><CheckCircle2 size={12} className="text-emerald-400" /></div>)}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function UrlField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Link className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
        <input className={cn(inputClass, 'pl-8')} value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
      <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:text-slate-200" aria-label="Copiar URL" title="Copiar URL" onClick={() => navigator.clipboard?.writeText(value)}><Copy size={14} /></button>
    </div>
  );
}

function SettingsPanel({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5"><div className="mb-5 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Icon size={16} /></div><div><h2 className="text-sm font-semibold text-slate-200">{title}</h2><p className="text-[11px] text-slate-500">{description}</p></div></div><div className="space-y-4">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className={labelClass}>{label}</span>{children}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <button onClick={onChange} className="flex w-full items-center justify-between rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 text-left" aria-pressed={checked}><span className="text-[12px] font-medium text-slate-300">{label}</span><span className={cn('flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-blue-600' : 'bg-slate-800')}><span className={cn('h-4 w-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} /></span></button>;
}

function StatusPill({ status, label }: { status: ConnectionStatus; label: string }) {
  return <span className={cn('inline-flex w-fit items-center rounded border px-2 py-1 text-[10px] font-bold', statusStyles[status])}>{label}</span>;
}
