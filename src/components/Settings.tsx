import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Copy,
  Edit3,
  Link,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Sheet,
  Trash2,
  Webhook,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  defaultIntegrationSettings,
  loadSheetData,
  saveIntegrationSettings,
  subscribeIntegrationSettings,
  toCsvUrl,
  type AdAccountConfig,
  type ConnectionStatus,
  type IntegrationSettings,
  type SalesSheetConfig,
  type WebhookConfig,
} from '../lib/integrations';
import { cn } from '../lib/utils';

type ConnectionType = 'sales' | 'ads' | 'webhook';
type ModalMode = 'select' | ConnectionType;

type ConnectionItem = {
  id: string;
  type: ConnectionType;
  title: string;
  subtitle: string;
  status: ConnectionStatus;
  detail: string;
  icon: LucideIcon;
};

const statusStyles: Record<ConnectionStatus, string> = {
  Ativa: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  Pendente: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  Erro: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

const inputClass = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
const labelClass = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500';

const emptyAdAccount: AdAccountConfig = {
  id: '',
  name: '',
  platform: 'Meta Ads',
  accountId: '',
  spreadsheetUrl: '',
  sheetName: 'Página 1',
  gid: '0',
  dateColumn: 'data',
  spendColumn: 'valor gasto',
  campaignColumn: 'campanha',
  status: 'Ativa',
};

export function Settings() {
  const [settings, setSettings] = useState<IntegrationSettings>(defaultIntegrationSettings);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [salesDraft, setSalesDraft] = useState<SalesSheetConfig>(defaultIntegrationSettings.sales);
  const [adDraft, setAdDraft] = useState<AdAccountConfig>(emptyAdAccount);
  const [webhookDraft, setWebhookDraft] = useState<WebhookConfig>(defaultIntegrationSettings.webhook);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testState, setTestState] = useState<'idle' | 'testing'>('idle');
  const [testMessage, setTestMessage] = useState('Escolha um tipo de conexão para configurar as fontes de dados da aplicação.');

  useEffect(() => {
    return subscribeIntegrationSettings(setSettings, () => setSettings(defaultIntegrationSettings));
  }, []);

  const connections = useMemo<ConnectionItem[]>(() => {
    const sales: ConnectionItem = {
      id: 'sales',
      type: 'sales',
      title: 'Vendas',
      subtitle: settings.sales.platform || 'Planilha de vendas',
      status: settings.sales.status,
      detail: settings.sales.spreadsheetUrl ? settings.sales.sheetName : 'Nenhuma URL configurada',
      icon: Sheet,
    };

    const ads = settings.adAccounts.map((account): ConnectionItem => ({
      id: account.id,
      type: 'ads',
      title: account.name || 'Conta de anúncio',
      subtitle: account.platform,
      status: account.status,
      detail: account.spreadsheetUrl ? account.sheetName : 'Nenhuma URL configurada',
      icon: Megaphone,
    }));

    const webhook: ConnectionItem = {
      id: 'webhook',
      type: 'webhook',
      title: settings.webhook.name || 'Webhook',
      subtitle: 'Automação WhatsApp',
      status: settings.webhook.url ? 'Ativa' : 'Pendente',
      detail: settings.webhook.cadence,
      icon: Webhook,
    };

    return [sales, ...ads, webhook];
  }, [settings]);

  const activeConnections = connections.filter((item) => item.status === 'Ativa').length;
  const pendingConnections = connections.filter((item) => item.status !== 'Ativa').length;

  const openCreate = () => {
    setEditingId(null);
    setModalMode('select');
  };

  const openType = (type: ConnectionType) => {
    setEditingId(null);
    if (type === 'sales') setSalesDraft(settings.sales);
    if (type === 'ads') setAdDraft({ ...emptyAdAccount, id: `ads-${Date.now()}` });
    if (type === 'webhook') setWebhookDraft(settings.webhook);
    setModalMode(type);
  };

  const openEdit = (item: ConnectionItem) => {
    setEditingId(item.id);
    if (item.type === 'sales') {
      setSalesDraft(settings.sales);
      setModalMode('sales');
    }
    if (item.type === 'ads') {
      const account = settings.adAccounts.find((entry) => entry.id === item.id);
      if (account) setAdDraft(account);
      setModalMode('ads');
    }
    if (item.type === 'webhook') {
      setWebhookDraft(settings.webhook);
      setModalMode('webhook');
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
  };

  const saveDraft = () => {
    if (modalMode === 'sales') {
      setSettings((current) => ({ ...current, sales: salesDraft }));
      closeModal();
    }
    if (modalMode === 'ads') {
      setSettings((current) => ({
        ...current,
        adAccounts: editingId
          ? current.adAccounts.map((account) => (account.id === editingId ? adDraft : account))
          : [...current.adAccounts, { ...adDraft, id: adDraft.id || `ads-${Date.now()}` }],
      }));
      closeModal();
    }
    if (modalMode === 'webhook') {
      setSettings((current) => ({ ...current, webhook: webhookDraft }));
      closeModal();
    }
  };

  const removeConnection = (item: ConnectionItem) => {
    if (item.type === 'ads') {
      setSettings((current) => ({ ...current, adAccounts: current.adAccounts.filter((account) => account.id !== item.id) }));
    }
    if (item.type === 'webhook') {
      setSettings((current) => ({ ...current, webhook: defaultIntegrationSettings.webhook }));
    }
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
            Gerencie conexões de vendas, contas de anúncios e webhooks em um só lugar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={testSheets} className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:text-white">
            <RefreshCw size={13} className={cn(testState === 'testing' && 'animate-spin')} />
            Testar conexões
          </button>
          <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500">
            {saveState === 'saved' ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saveState === 'saving' ? 'Salvando' : saveState === 'saved' ? 'Salvo' : saveState === 'error' ? 'Erro' : 'Salvar'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Conexões" value={connections.length} detail="fontes cadastradas" icon={Link} />
        <SummaryCard label="Ativas" value={activeConnections} detail="prontas para leitura" icon={CheckCircle2} />
        <SummaryCard label="Pendências" value={pendingConnections} detail="exigem revisão" icon={AlertTriangle} />
      </section>

      <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 text-[12px] leading-5 text-amber-200">
        {testMessage}
      </div>

      <section className="rounded-2xl border border-slate-900/60 bg-slate-950 p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Conexões configuradas</h2>
            <p className="mt-1 text-[11px] text-slate-500">Selecione uma conexão para editar ou crie uma nova fonte.</p>
          </div>
          <button onClick={openCreate} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-bold text-white transition-colors hover:bg-blue-500">
            <Plus size={13} />
            Nova conexão
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-900 custom-scrollbar">
          <div className="min-w-[760px] divide-y divide-slate-900">
            <div className="grid grid-cols-[1.4fr_0.8fr_1fr_0.8fr_120px] gap-4 bg-slate-900/30 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              <span>Conexão</span><span>Tipo</span><span>Detalhe</span><span>Status</span><span />
            </div>
            {connections.map((item, index) => <div key={item.id}><ConnectionRow item={item} index={index} onEdit={() => openEdit(item)} onRemove={() => removeConnection(item)} /></div>)}
          </div>
        </div>
      </section>

      {modalMode && (
        <ConnectionModal title={getModalTitle(modalMode, editingId)} onClose={closeModal}>
          {modalMode === 'select' && <ConnectionTypePicker onSelect={openType} />}
          {modalMode === 'sales' && <SalesForm draft={salesDraft} onChange={setSalesDraft} />}
          {modalMode === 'ads' && <AdForm draft={adDraft} onChange={setAdDraft} />}
          {modalMode === 'webhook' && <WebhookForm draft={webhookDraft} onChange={setWebhookDraft} />}
          {modalMode !== 'select' && <ModalActions onClose={closeModal} onSave={saveDraft} disabled={!canSave(modalMode, salesDraft, adDraft, webhookDraft)} />}
        </ConnectionModal>
      )}
    </div>
  );
}

function ConnectionTypePicker({ onSelect }: { onSelect: (type: ConnectionType) => void }) {
  const items: Array<{ type: ConnectionType; title: string; description: string; icon: LucideIcon }> = [
    { type: 'sales', title: 'Vendas', description: 'Receita, pedidos, produto e data da venda.', icon: Sheet },
    { type: 'ads', title: 'Conta de anúncio', description: 'Gasto de mídia por conta, campanha e data.', icon: Megaphone },
    { type: 'webhook', title: 'Webhook', description: 'Automação para enviar atividades abertas.', icon: Webhook },
  ];
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{items.map((item) => { const Icon = item.icon; return <button key={item.type} onClick={() => onSelect(item.type)} className="rounded-xl border border-slate-900 bg-slate-950 p-4 text-left transition-colors hover:border-blue-500/40"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Icon size={16} /></div><p className="text-sm font-semibold text-slate-200">{item.title}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{item.description}</p></button>; })}</div>;
}

function SalesForm({ draft, onChange }: { draft: SalesSheetConfig; onChange: (draft: SalesSheetConfig) => void }) {
  return <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Field label="Nome da fonte"><input className={inputClass} value={draft.platform} onChange={(event) => onChange({ ...draft, platform: event.target.value })} /></Field><Field label="Aba"><input className={inputClass} value={draft.sheetName} onChange={(event) => onChange({ ...draft, sheetName: event.target.value })} /></Field><Field label="GID"><input className={inputClass} value={draft.gid} onChange={(event) => onChange({ ...draft, gid: event.target.value })} /></Field><Field label="Coluna data"><input className={inputClass} value={draft.dateColumn} onChange={(event) => onChange({ ...draft, dateColumn: event.target.value })} /></Field><Field label="Coluna receita"><input className={inputClass} value={draft.revenueColumn} onChange={(event) => onChange({ ...draft, revenueColumn: event.target.value })} /></Field><Field label="Coluna pedido"><input className={inputClass} value={draft.orderColumn} onChange={(event) => onChange({ ...draft, orderColumn: event.target.value })} placeholder="opcional" /></Field><Field label="Coluna produto"><input className={inputClass} value={draft.productColumn} onChange={(event) => onChange({ ...draft, productColumn: event.target.value })} /></Field><Field label="Coluna status"><input className={inputClass} value={draft.statusColumn} onChange={(event) => onChange({ ...draft, statusColumn: event.target.value })} /></Field><Field label="Status"><StatusSelect value={draft.status} onChange={(status) => onChange({ ...draft, status })} /></Field></div><Field label="URL da planilha"><UrlField value={draft.spreadsheetUrl} onChange={(value) => onChange({ ...draft, spreadsheetUrl: value })} /></Field><p className="rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 font-mono text-[10px] text-slate-500">CSV: {toCsvUrl(draft.spreadsheetUrl, draft.gid)}</p></div>;
}

function AdForm({ draft, onChange }: { draft: AdAccountConfig; onChange: (draft: AdAccountConfig) => void }) {
  return <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Field label="Nome da conta"><input className={inputClass} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></Field><Field label="Plataforma"><select className={inputClass} value={draft.platform} onChange={(event) => onChange({ ...draft, platform: event.target.value })}><option>Meta Ads</option><option>Google Ads</option><option>TikTok Ads</option><option>LinkedIn Ads</option></select></Field><Field label="ID da conta"><input className={inputClass} value={draft.accountId} onChange={(event) => onChange({ ...draft, accountId: event.target.value })} /></Field><Field label="Aba"><input className={inputClass} value={draft.sheetName} onChange={(event) => onChange({ ...draft, sheetName: event.target.value })} /></Field><Field label="GID"><input className={inputClass} value={draft.gid} onChange={(event) => onChange({ ...draft, gid: event.target.value })} /></Field><Field label="Status"><StatusSelect value={draft.status} onChange={(status) => onChange({ ...draft, status })} /></Field><Field label="Coluna data"><input className={inputClass} value={draft.dateColumn} onChange={(event) => onChange({ ...draft, dateColumn: event.target.value })} /></Field><Field label="Coluna gasto"><input className={inputClass} value={draft.spendColumn} onChange={(event) => onChange({ ...draft, spendColumn: event.target.value })} /></Field><Field label="Coluna campanha"><input className={inputClass} value={draft.campaignColumn} onChange={(event) => onChange({ ...draft, campaignColumn: event.target.value })} /></Field></div><Field label="URL da planilha"><UrlField value={draft.spreadsheetUrl} onChange={(value) => onChange({ ...draft, spreadsheetUrl: value })} /></Field></div>;
}

function WebhookForm({ draft, onChange }: { draft: WebhookConfig; onChange: (draft: WebhookConfig) => void }) {
  return <div className="space-y-4"><Field label="Nome"><input className={inputClass} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></Field><Field label="URL"><input className={inputClass} value={draft.url} onChange={(event) => onChange({ ...draft, url: event.target.value })} /></Field><Field label="Envio"><select className={inputClass} value={draft.cadence} onChange={(event) => onChange({ ...draft, cadence: event.target.value })}><option>Diário às 08:30</option><option>Diário às 18:00</option><option>Segunda, quarta e sexta</option><option>Manual</option></select></Field><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><Toggle label="Incluir responsáveis" checked={draft.includeOwners} onChange={() => onChange({ ...draft, includeOwners: !draft.includeOwners })} /><Toggle label="Incluir prazos" checked={draft.includeDueDates} onChange={() => onChange({ ...draft, includeDueDates: !draft.includeDueDates })} /></div><button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[11px] font-bold text-blue-300 transition-colors hover:text-blue-100"><BellRing size={13} />Testar webhook</button></div>;
}

function ConnectionRow({ item, index, onEdit, onRemove }: { item: ConnectionItem; index: number; onEdit: () => void; onRemove: () => void }) {
  const Icon = item.icon;
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }} className="grid grid-cols-[1.4fr_0.8fr_1fr_0.8fr_120px] items-center gap-4 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Icon size={15} /></div><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-slate-300">{item.title}</p><p className="truncate text-[10px] text-slate-600">{item.subtitle}</p></div></div><span className="text-[11px] text-slate-500">{getTypeLabel(item.type)}</span><span className="truncate text-[11px] text-slate-500">{item.detail}</span><StatusPill status={item.status} label={item.status} /><div className="flex justify-end gap-1"><IconButton label="Editar" onClick={onEdit}><Edit3 size={13} /></IconButton>{item.type !== 'sales' && <IconButton label="Remover" onClick={onRemove}><Trash2 size={13} /></IconButton>}</div></motion.div>;
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: number; detail: string; icon: LucideIcon }) {
  return <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-slate-900/80 bg-slate-950 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 font-mono text-lg font-bold tracking-tighter text-slate-100">{value}</p><p className="mt-1 text-[11px] text-slate-600">{detail}</p></div><div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Icon size={15} /></div></div></motion.div>;
}

function ConnectionModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm"><div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl custom-scrollbar"><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-100">{title}</h2><IconButton label="Fechar" onClick={onClose}><X size={14} /></IconButton></div>{children}</div></div>;
}

function ModalActions({ onClose, onSave, disabled }: { onClose: () => void; onSave: () => void; disabled?: boolean }) {
  return <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-100">Cancelar</button><button onClick={onSave} disabled={disabled} className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">Salvar conexão</button></div>;
}

function UrlField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex gap-2"><div className="relative flex-1"><Link className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" /><input className={cn(inputClass, 'pl-8')} value={value} onChange={(event) => onChange(event.target.value)} /></div><button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:text-slate-200" aria-label="Copiar URL" title="Copiar URL" onClick={() => navigator.clipboard?.writeText(value)}><Copy size={14} /></button></div>;
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

function StatusSelect({ value, onChange }: { value: ConnectionStatus; onChange: (status: ConnectionStatus) => void }) {
  return <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value as ConnectionStatus)}><option>Ativa</option><option>Pendente</option><option>Erro</option></select>;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:text-slate-200">{children}</button>;
}

function getModalTitle(mode: ModalMode, editingId: string | null) {
  if (mode === 'select') return 'Nova conexão';
  const action = editingId ? 'Editar' : 'Criar';
  if (mode === 'sales') return `${action} conexão de vendas`;
  if (mode === 'ads') return `${action} conta de anúncio`;
  return `${action} webhook`;
}

function getTypeLabel(type: ConnectionType) {
  if (type === 'sales') return 'Vendas';
  if (type === 'ads') return 'Anúncios';
  return 'Webhook';
}

function canSave(mode: ModalMode, sales: SalesSheetConfig, ad: AdAccountConfig, webhook: WebhookConfig) {
  if (mode === 'sales') return Boolean(sales.platform.trim() && sales.spreadsheetUrl.trim() && sales.dateColumn.trim() && sales.revenueColumn.trim());
  if (mode === 'ads') return Boolean(ad.name.trim() && ad.spreadsheetUrl.trim() && ad.dateColumn.trim() && ad.spendColumn.trim());
  if (mode === 'webhook') return Boolean(webhook.name.trim() && webhook.url.trim());
  return false;
}
