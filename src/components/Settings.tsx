import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  CheckCircle2,
  Copy,
  Link,
  Megaphone,
  Plus,
  Save,
  Settings2,
  Sheet,
  Trash2,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils';

type ConnectionStatus = 'Ativa' | 'Pendente' | 'Erro';

interface SalesSheetConfig {
  platform: string;
  spreadsheetUrl: string;
  sheetName: string;
  revenueColumn: string;
  dateColumn: string;
  status: ConnectionStatus;
}

interface AdAccountConfig {
  id: number;
  name: string;
  platform: string;
  accountId: string;
  spreadsheetUrl: string;
  sheetName: string;
  status: ConnectionStatus;
}

interface WebhookConfig {
  name: string;
  url: string;
  cadence: string;
  includeOwners: boolean;
  includeDueDates: boolean;
}

const statusStyles: Record<ConnectionStatus, string> = {
  Ativa: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  Pendente: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  Erro: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

const inputClass =
  'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';

export function Settings() {
  const [salesConfig, setSalesConfig] = useState<SalesSheetConfig>({
    platform: 'Hotmart',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/vendas-operacao',
    sheetName: 'Vendas',
    revenueColumn: 'valor_liquido',
    dateColumn: 'data_venda',
    status: 'Ativa',
  });

  const [adAccounts, setAdAccounts] = useState<AdAccountConfig[]>([
    {
      id: 1,
      name: 'Meta Ads Principal',
      platform: 'Meta Ads',
      accountId: 'act_1029384756',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/meta-principal',
      sheetName: 'Investimento',
      status: 'Ativa',
    },
    {
      id: 2,
      name: 'Google Search',
      platform: 'Google Ads',
      accountId: 'BR-293-001',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/google-search',
      sheetName: 'Campanhas',
      status: 'Pendente',
    },
  ]);

  const [draftAccount, setDraftAccount] = useState({
    name: '',
    platform: 'Meta Ads',
    accountId: '',
    spreadsheetUrl: '',
    sheetName: 'Campanhas',
  });

  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    name: 'Atividades abertas - WhatsApp',
    url: 'https://hooks.zapier.com/hooks/catch/time/atividades',
    cadence: 'Diário às 08:30',
    includeOwners: true,
    includeDueDates: true,
  });

  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const activeConnections = adAccounts.filter((account) => account.status === 'Ativa').length + (salesConfig.status === 'Ativa' ? 1 : 0);

  const addAdAccount = () => {
    if (!draftAccount.name || !draftAccount.spreadsheetUrl) return;

    setAdAccounts((current) => [
      ...current,
      {
        id: Date.now(),
        ...draftAccount,
        status: 'Pendente',
      },
    ]);
    setDraftAccount({
      name: '',
      platform: 'Meta Ads',
      accountId: '',
      spreadsheetUrl: '',
      sheetName: 'Campanhas',
    });
  };

  const removeAdAccount = (id: number) => {
    setAdAccounts((current) => current.filter((account) => account.id !== id));
  };

  const markSaved = () => {
    setSaveState('saved');
    window.setTimeout(() => setSaveState('idle'), 1800);
  };

  return (
    <div className="mx-auto max-w-[1450px] space-y-6 p-10 text-slate-300">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Dados e automações</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Configurações</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
            Centralize as planilhas que alimentam os dashboards e o webhook que aciona o WhatsApp da equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status="Ativa" label={`${activeConnections} conexões ativas`} />
          <button
            onClick={markSaved}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500"
          >
            {saveState === 'saved' ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saveState === 'saved' ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Vendas', value: salesConfig.platform, detail: salesConfig.sheetName, icon: Sheet },
          { label: 'Contas de anúncios', value: adAccounts.length, detail: `${activeConnections - (salesConfig.status === 'Ativa' ? 1 : 0)} ativas`, icon: Megaphone },
          { label: 'Webhook', value: webhookConfig.cadence, detail: webhookConfig.name, icon: Webhook },
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <SettingsPanel icon={Sheet} title="Planilha de vendas" description="Fonte principal para receita, pedidos e conversão.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Plataforma">
                <input
                  className={inputClass}
                  value={salesConfig.platform}
                  onChange={(event) => setSalesConfig({ ...salesConfig, platform: event.target.value })}
                />
              </Field>
              <Field label="Aba">
                <input
                  className={inputClass}
                  value={salesConfig.sheetName}
                  onChange={(event) => setSalesConfig({ ...salesConfig, sheetName: event.target.value })}
                />
              </Field>
              <Field label="Coluna de data">
                <input
                  className={inputClass}
                  value={salesConfig.dateColumn}
                  onChange={(event) => setSalesConfig({ ...salesConfig, dateColumn: event.target.value })}
                />
              </Field>
              <Field label="Coluna de receita">
                <input
                  className={inputClass}
                  value={salesConfig.revenueColumn}
                  onChange={(event) => setSalesConfig({ ...salesConfig, revenueColumn: event.target.value })}
                />
              </Field>
            </div>
            <Field label="URL da planilha">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <input
                    className={cn(inputClass, 'pl-8')}
                    value={salesConfig.spreadsheetUrl}
                    onChange={(event) => setSalesConfig({ ...salesConfig, spreadsheetUrl: event.target.value })}
                  />
                </div>
                <button
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:text-slate-200"
                  aria-label="Copiar URL da planilha de vendas"
                  title="Copiar URL"
                >
                  <Copy size={14} />
                </button>
              </div>
            </Field>
          </SettingsPanel>

          <SettingsPanel icon={Megaphone} title="Contas de anúncios" description="Cada conta pode apontar para sua própria planilha.">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
              <input
                className={cn(inputClass, 'lg:col-span-1')}
                placeholder="Nome"
                value={draftAccount.name}
                onChange={(event) => setDraftAccount({ ...draftAccount, name: event.target.value })}
              />
              <select
                className={cn(inputClass, 'lg:col-span-1')}
                value={draftAccount.platform}
                onChange={(event) => setDraftAccount({ ...draftAccount, platform: event.target.value })}
              >
                <option>Meta Ads</option>
                <option>Google Ads</option>
                <option>TikTok Ads</option>
                <option>LinkedIn Ads</option>
              </select>
              <input
                className={cn(inputClass, 'lg:col-span-1')}
                placeholder="ID da conta"
                value={draftAccount.accountId}
                onChange={(event) => setDraftAccount({ ...draftAccount, accountId: event.target.value })}
              />
              <input
                className={cn(inputClass, 'lg:col-span-1')}
                placeholder="URL da planilha"
                value={draftAccount.spreadsheetUrl}
                onChange={(event) => setDraftAccount({ ...draftAccount, spreadsheetUrl: event.target.value })}
              />
              <button
                onClick={addAdAccount}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 text-[11px] font-bold text-slate-300 transition-colors hover:text-white"
              >
                <Plus size={13} />
                Adicionar
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-900 custom-scrollbar">
              <div className="min-w-[680px]">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_44px] gap-3 border-b border-slate-900 bg-slate-900/30 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                  <span>Conta</span>
                  <span>Plataforma</span>
                  <span>Planilha</span>
                  <span>Status</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-900">
                  {adAccounts.map((account) => (
                    <div key={account.id} className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_44px] items-center gap-3 px-4 py-3">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-300">{account.name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-600">{account.accountId || 'Sem ID'}</p>
                      </div>
                      <p className="text-[11px] text-slate-400">{account.platform}</p>
                      <p className="truncate text-[11px] text-slate-500">{account.sheetName}</p>
                      <StatusPill status={account.status} label={account.status} />
                    <button
                      onClick={() => removeAdAccount(account.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-900 hover:text-rose-300"
                      aria-label={`Remover ${account.name}`}
                      title="Remover conta"
                    >
                      <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SettingsPanel>
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <SettingsPanel icon={Webhook} title="Webhook da equipe" description="Automação para enviar atividades abertas no WhatsApp.">
            <Field label="Nome">
              <input
                className={inputClass}
                value={webhookConfig.name}
                onChange={(event) => setWebhookConfig({ ...webhookConfig, name: event.target.value })}
              />
            </Field>
            <Field label="URL">
              <input
                className={inputClass}
                value={webhookConfig.url}
                onChange={(event) => setWebhookConfig({ ...webhookConfig, url: event.target.value })}
              />
            </Field>
            <Field label="Envio">
              <select
                className={inputClass}
                value={webhookConfig.cadence}
                onChange={(event) => setWebhookConfig({ ...webhookConfig, cadence: event.target.value })}
              >
                <option>Diário às 08:30</option>
                <option>Diário às 18:00</option>
                <option>Segunda, quarta e sexta</option>
                <option>Manual</option>
              </select>
            </Field>

            <div className="space-y-3">
              <Toggle
                label="Responsáveis"
                checked={webhookConfig.includeOwners}
                onChange={() => setWebhookConfig({ ...webhookConfig, includeOwners: !webhookConfig.includeOwners })}
              />
              <Toggle
                label="Prazos"
                checked={webhookConfig.includeDueDates}
                onChange={() => setWebhookConfig({ ...webhookConfig, includeDueDates: !webhookConfig.includeDueDates })}
              />
            </div>

            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[11px] font-bold text-blue-300 transition-colors hover:text-blue-100">
              <BellRing size={13} />
              Testar webhook
            </button>
          </SettingsPanel>

          <div className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400">
                <Settings2 size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Campos esperados</h2>
                <p className="text-[11px] text-slate-500">Padrão para leitura das planilhas.</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {['data', 'campanha', 'receita', 'investimento', 'leads', 'status'].map((field) => (
                <div key={field} className="flex items-center justify-between rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2">
                  <span className="font-mono text-[11px] text-slate-400">{field}</span>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function SettingsPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-900/50 bg-slate-950 p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400">
          <Icon size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          <p className="text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 text-left"
      aria-pressed={checked}
    >
      <span className="text-[12px] font-medium text-slate-300">{label}</span>
      <span className={cn('flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', checked ? 'bg-blue-600' : 'bg-slate-800')}>
        <span className={cn('h-4 w-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} />
      </span>
    </button>
  );
}

function StatusPill({ status, label }: { status: ConnectionStatus; label: string }) {
  return <span className={cn('inline-flex w-fit items-center rounded border px-2 py-1 text-[10px] font-bold', statusStyles[status])}>{label}</span>;
}
