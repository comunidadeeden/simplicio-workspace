import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  Link,
  Megaphone,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Sheet,
  Trash2,
  UsersRound,
  Webhook,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  defaultIntegrationSettings,
  defaultGenericSheet,
  defaultSalesSource,
  inspectSheetConnection,
  loadSheetData,
  saveIntegrationSettings,
  subscribeIntegrationSettings,
  type AdAccountConfig,
  type ConnectionStatus,
  type GenericSheetConfig,
  type IntegrationSettings,
  type SalesSheetConfig,
  type WebhookConfig,
} from '../lib/integrations';
import { cn } from '../lib/utils';

type ConnectionType = 'sales' | 'ads' | 'group' | 'live' | 'webhook';
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

const emptySalesSource: SalesSheetConfig = {
  ...defaultSalesSource,
  id: '',
  platform: '',
  spreadsheetUrl: '',
};

const emptyGenericSheet: GenericSheetConfig = {
  ...defaultGenericSheet,
};

const emptyAdAccount: AdAccountConfig = {
  id: '',
  name: '',
  platform: 'Meta Ads',
  accountId: '',
  spreadsheetUrl: '',
  sheetName: 'Página 1',
  gid: '0',
  dateColumn: 'Day',
  spendColumn: 'Amount Spent',
  campaignColumn: 'Campaign Name',
  status: 'Ativa',
};

export function Settings() {
  const [settings, setSettings] = useState<IntegrationSettings>(defaultIntegrationSettings);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [salesDraft, setSalesDraft] = useState<SalesSheetConfig>(emptySalesSource);
  const [adDraft, setAdDraft] = useState<AdAccountConfig>(emptyAdAccount);
  const [genericDraft, setGenericDraft] = useState<GenericSheetConfig>(emptyGenericSheet);
  const [webhookDraft, setWebhookDraft] = useState<WebhookConfig>(defaultIntegrationSettings.webhook);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testState, setTestState] = useState<'idle' | 'testing'>('idle');
  const [testMessage, setTestMessage] = useState('Escolha um tipo de conexão para configurar as fontes de dados da aplicação.');
  const [inspectState, setInspectState] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [inspectMessage, setInspectMessage] = useState('Cole a URL da planilha para detectar as colunas automaticamente.');
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  useEffect(() => {
    return subscribeIntegrationSettings(setSettings, () => setSettings(defaultIntegrationSettings));
  }, []);


  useEffect(() => {
    const isSales = modalMode === 'sales';
    const isAds = modalMode === 'ads';
    const isGeneric = modalMode === 'group' || modalMode === 'live';
    if (!isSales && !isAds && !isGeneric) {
      setInspectState('idle');
      setDetectedColumns([]);
      return;
    }

    const draft = isSales ? salesDraft : isAds ? adDraft : genericDraft;
    if (!draft.spreadsheetUrl.trim()) {
      setInspectState('idle');
      setDetectedColumns([]);
      setInspectMessage('Cole a URL da planilha para detectar as colunas automaticamente.');
      return;
    }

    setInspectState('checking');
    setInspectMessage('Verificando planilha e lendo cabeçalhos...');
    const timeout = window.setTimeout(() => {
      void inspectSheetConnection(isSales ? 'sales' : isAds ? 'ads' : 'generic', draft.spreadsheetUrl, draft.gid).then((preview) => {
        setDetectedColumns(preview.columns);
        setInspectState('ready');
        const requiredColumnsFound = isGeneric || (isSales
          ? Boolean(preview.detected.dateColumn && preview.detected.revenueColumn)
          : Boolean(preview.detected.dateColumn && preview.detected.spendColumn));
        setInspectMessage(requiredColumnsFound
          ? `Conexão pronta: ${preview.columns.length} colunas encontradas em ${preview.rowCount} linhas.`
          : `Essa aba foi lida, mas parece não ser uma planilha de ${isSales ? 'vendas' : 'anúncios'}.`);
        if (isSales) {
          setSalesDraft((current) => current.spreadsheetUrl === draft.spreadsheetUrl && current.gid === draft.gid
            ? { ...current, ...preview.detected }
            : current);
        } else if (isAds) {
          setAdDraft((current) => current.spreadsheetUrl === draft.spreadsheetUrl && current.gid === draft.gid
            ? { ...current, ...preview.detected }
            : current);
        }
      }).catch((error) => {
        setDetectedColumns([]);
        setInspectState('error');
        setInspectMessage(error instanceof Error ? error.message : 'Não foi possível verificar essa planilha.');
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [adDraft.gid, adDraft.spreadsheetUrl, genericDraft.gid, genericDraft.spreadsheetUrl, modalMode, salesDraft.gid, salesDraft.spreadsheetUrl]);

  const connections = useMemo<ConnectionItem[]>(() => {
    const sales = settings.salesSources.map((source): ConnectionItem => ({
      id: source.id,
      type: 'sales',
      title: source.platform || 'Fonte de vendas',
      subtitle: 'Planilha de vendas',
      status: source.status,
      detail: source.spreadsheetUrl ? `Aba ${source.gid || '0'}` : 'Nenhuma URL configurada',
      icon: Sheet,
    }));

    const ads = settings.adAccounts.map((account): ConnectionItem => ({
      id: account.id,
      type: 'ads',
      title: account.name || 'Conta de anúncio',
      subtitle: account.platform,
      status: account.status,
      detail: account.spreadsheetUrl ? `Aba ${account.gid || '0'}` : 'Nenhuma URL configurada',
      icon: Megaphone,
    }));

    const groups = settings.groupSources.map((source): ConnectionItem => ({
      id: source.id,
      type: 'group',
      title: source.name || 'Dados do grupo',
      subtitle: 'Planilha do grupo',
      status: source.status,
      detail: source.spreadsheetUrl ? `Aba ${source.gid || '0'}` : 'Nenhuma URL configurada',
      icon: UsersRound,
    }));

    const lives = settings.liveSources.map((source): ConnectionItem => ({
      id: source.id,
      type: 'live',
      title: source.name || 'Dados da live',
      subtitle: 'Planilha da live',
      status: source.status,
      detail: source.spreadsheetUrl ? `Aba ${source.gid || '0'}` : 'Nenhuma URL configurada',
      icon: PlayCircle,
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

    return [...sales, ...ads, ...groups, ...lives, webhook];
  }, [settings]);

  const activeConnections = connections.filter((item) => item.status === 'Ativa').length;
  const pendingConnections = connections.filter((item) => item.status !== 'Ativa').length;

  const openCreate = () => {
    setEditingId(null);
    setModalMode('select');
  };

  const openType = (type: ConnectionType) => {
    setEditingId(null);
    if (type === 'sales') setSalesDraft({ ...emptySalesSource, id: `sales-${Date.now()}`, platform: 'Vendas' });
    if (type === 'ads') setAdDraft({ ...emptyAdAccount, id: `ads-${Date.now()}` });
    if (type === 'group') setGenericDraft({ ...emptyGenericSheet, id: `group-${Date.now()}`, name: 'Grupo WhatsApp' });
    if (type === 'live') setGenericDraft({ ...emptyGenericSheet, id: `live-${Date.now()}`, name: 'Live' });
    if (type === 'webhook') setWebhookDraft(settings.webhook);
    setModalMode(type);
  };

  const openEdit = (item: ConnectionItem) => {
    setEditingId(item.id);
    if (item.type === 'sales') {
      const source = settings.salesSources.find((entry) => entry.id === item.id);
      if (source) setSalesDraft(source);
      setModalMode('sales');
    }
    if (item.type === 'ads') {
      const account = settings.adAccounts.find((entry) => entry.id === item.id);
      if (account) setAdDraft(account);
      setModalMode('ads');
    }
    if (item.type === 'group') {
      const source = settings.groupSources.find((entry) => entry.id === item.id);
      if (source) setGenericDraft(source);
      setModalMode('group');
    }
    if (item.type === 'live') {
      const source = settings.liveSources.find((entry) => entry.id === item.id);
      if (source) setGenericDraft(source);
      setModalMode('live');
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
      setSettings((current) => ({
        ...current,
        salesSources: editingId
          ? current.salesSources.map((source) => (source.id === editingId ? salesDraft : source))
          : [...current.salesSources, { ...salesDraft, id: salesDraft.id || `sales-${Date.now()}` }],
      }));
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
    if (modalMode === 'group') {
      setSettings((current) => ({
        ...current,
        groupSources: editingId
          ? current.groupSources.map((source) => (source.id === editingId ? genericDraft : source))
          : [...current.groupSources, { ...genericDraft, id: genericDraft.id || `group-${Date.now()}` }],
      }));
      closeModal();
    }
    if (modalMode === 'live') {
      setSettings((current) => ({
        ...current,
        liveSources: editingId
          ? current.liveSources.map((source) => (source.id === editingId ? genericDraft : source))
          : [...current.liveSources, { ...genericDraft, id: genericDraft.id || `live-${Date.now()}` }],
      }));
      closeModal();
    }
    if (modalMode === 'webhook') {
      setSettings((current) => ({ ...current, webhook: webhookDraft }));
      closeModal();
    }
  };

  const removeConnection = (item: ConnectionItem) => {
    if (item.type === 'sales') {
      setSettings((current) => (current.salesSources.length > 1
        ? { ...current, salesSources: current.salesSources.filter((source) => source.id !== item.id) }
        : current));
    }
    if (item.type === 'ads') {
      setSettings((current) => ({ ...current, adAccounts: current.adAccounts.filter((account) => account.id !== item.id) }));
    }
    if (item.type === 'group') {
      setSettings((current) => ({ ...current, groupSources: current.groupSources.filter((source) => source.id !== item.id) }));
    }
    if (item.type === 'live') {
      setSettings((current) => ({ ...current, liveSources: current.liveSources.filter((source) => source.id !== item.id) }));
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
      setTestMessage(`Leitura parcial: ${result.sales.length} vendas, ${result.traffic.length} linhas de tráfego, ${result.groups.length} linhas de grupo e ${result.lives.length} linhas de live. Pendências: ${result.errors.join(' | ')}`);
      return;
    }
    setTestMessage(`Leitura OK: ${result.sales.length} vendas, ${result.traffic.length} linhas de tráfego, ${result.groups.length} linhas de grupo e ${result.lives.length} linhas de live importadas.`);
  };

  const testWebhook = async () => {
    const url = webhookDraft.url.trim() || defaultIntegrationSettings.webhook.url;
    if (!url) {
      setTestMessage('Informe a URL do webhook antes de testar.');
      return;
    }

    const payload = buildWebhookTestPayload(webhookDraft);
    setTestState('testing');
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload),
      });
      setTestMessage('Teste enviado para o webhook com uma atividade exemplo. Confira a execução no n8n.');
    } catch (error) {
      setTestMessage(`Não foi possível enviar o teste: ${error instanceof Error ? error.message : 'erro desconhecido'}.`);
    } finally {
      setTestState('idle');
    }
  };

  return (
    <div className="mx-auto max-w-[1450px] space-y-6 p-10 text-slate-300">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400">Dados e automações</p>
          <h1 className="mt-2 text-xl font-display font-bold tracking-tight text-slate-100">Configurações</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
            Gerencie vendas, anúncios, dados do grupo, dados da live e webhooks em um só lugar.
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
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><CalendarDays size={15} /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Configuração do ciclo</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">Define onde cada venda entra: ingresso até sábado no horário de corte fica no ciclo que está fechando; depois disso entra no próximo ciclo.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Dia de virada"><select className={inputClass} value={settings.cycle.cutoffWeekday} onChange={(event) => setSettings((current) => ({ ...current, cycle: { ...current.cycle, cutoffWeekday: Number(event.target.value) } }))}><option value={6}>Sábado</option><option value={5}>Sexta</option><option value={0}>Domingo</option></select></Field>
          <Field label="Horário de corte"><input className={inputClass} type="time" value={settings.cycle.cutoffTime} onChange={(event) => setSettings((current) => ({ ...current, cycle: { ...current.cycle, cutoffTime: event.target.value } }))} /></Field>
          <Field label="Dias vendendo ingresso"><input className={inputClass} type="number" min={1} value={settings.cycle.acquisitionDays} onChange={(event) => setSettings((current) => ({ ...current, cycle: { ...current.cycle, acquisitionDays: Number(event.target.value) || 7 } }))} /></Field>
          <Field label="Dias vendendo Éden"><input className={inputClass} type="number" min={1} value={settings.cycle.monetizationDays} onChange={(event) => setSettings((current) => ({ ...current, cycle: { ...current.cycle, monetizationDays: Number(event.target.value) || 7 } }))} /></Field>
        </div>
      </section>

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
            {connections.map((item, index) => <div key={item.id}><ConnectionRow item={item} index={index} canRemove={item.type !== 'sales' || settings.salesSources.length > 1} onEdit={() => openEdit(item)} onRemove={() => removeConnection(item)} /></div>)}
          </div>
        </div>
      </section>

      {modalMode && (
        <ConnectionModal title={getModalTitle(modalMode, editingId)} onClose={closeModal}>
          {modalMode === 'select' && <ConnectionTypePicker onSelect={openType} />}
          {modalMode === 'sales' && <SalesForm draft={salesDraft} onChange={setSalesDraft} inspectState={inspectState} inspectMessage={inspectMessage} columns={detectedColumns} />}
          {modalMode === 'ads' && <AdForm draft={adDraft} onChange={setAdDraft} inspectState={inspectState} inspectMessage={inspectMessage} columns={detectedColumns} />}
          {modalMode === 'group' && <GenericSheetForm title="Dados do grupo" helper="Use essa conexão para importar entradas, presença, mensagens, engajamento ou qualquer dado do grupo que venha por planilha." draft={genericDraft} onChange={setGenericDraft} inspectState={inspectState} inspectMessage={inspectMessage} columns={detectedColumns} />}
          {modalMode === 'live' && <GenericSheetForm title="Dados da live" helper="Use essa conexão para importar presença, pico de audiência, cliques, comentários, retenção ou qualquer dado da live." draft={genericDraft} onChange={setGenericDraft} inspectState={inspectState} inspectMessage={inspectMessage} columns={detectedColumns} />}
          {modalMode === 'webhook' && <WebhookForm draft={webhookDraft} onChange={setWebhookDraft} onTest={testWebhook} testState={testState} message={testMessage} />}
          {modalMode !== 'select' && <ModalActions onClose={closeModal} onSave={saveDraft} disabled={!canSave(modalMode, salesDraft, adDraft, genericDraft, webhookDraft)} />}
        </ConnectionModal>
      )}
    </div>
  );
}

function ConnectionTypePicker({ onSelect }: { onSelect: (type: ConnectionType) => void }) {
  const items: Array<{ type: ConnectionType; title: string; description: string; icon: LucideIcon }> = [
    { type: 'sales', title: 'Vendas', description: 'Receita, pedidos, produto e data da venda.', icon: Sheet },
    { type: 'ads', title: 'Conta de anúncio', description: 'Gasto de mídia por conta, campanha e data.', icon: Megaphone },
    { type: 'group', title: 'Dados do grupo', description: 'Entrada, presença e engajamento no grupo.', icon: UsersRound },
    { type: 'live', title: 'Dados da live', description: 'Audiência, presença, cliques e retenção.', icon: PlayCircle },
    { type: 'webhook', title: 'Webhook', description: 'Automação para enviar atividades abertas.', icon: Webhook },
  ];
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-5">{items.map((item) => { const Icon = item.icon; return <button key={item.type} onClick={() => onSelect(item.type)} className="rounded-xl border border-slate-900 bg-slate-950 p-4 text-left transition-colors hover:border-blue-500/40"><div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Icon size={16} /></div><p className="text-sm font-semibold text-slate-200">{item.title}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{item.description}</p></button>; })}</div>;
}

function SalesForm({ draft, onChange, inspectState, inspectMessage, columns }: { draft: SalesSheetConfig; onChange: (draft: SalesSheetConfig) => void; inspectState: InspectState; inspectMessage: string; columns: string[] }) {
  const updateUrl = (value: string) => onChange({ ...draft, spreadsheetUrl: value, gid: extractGid(value, draft.gid) });
  const feePercent = draft.platformFeeRate > 1 ? draft.platformFeeRate : draft.platformFeeRate * 100;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_160px]">
        <Field label="Nome da fonte"><input className={inputClass} value={draft.platform} placeholder="Hubla, Hotmart, Kiwify..." onChange={(event) => onChange({ ...draft, platform: event.target.value })} /></Field>
        <Field label="Status"><StatusSelect value={draft.status} onChange={(status) => onChange({ ...draft, status })} /></Field>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
        <Field label="URL da aba de vendas"><UrlField value={draft.spreadsheetUrl} onChange={updateUrl} /></Field>
        <Field label="Taxa da plataforma (%)"><input className={inputClass} type="number" min={0} step="0.01" value={Number.isFinite(feePercent) ? feePercent : 0} onChange={(event) => onChange({ ...draft, platformFeeRate: Number(event.target.value) / 100 })} /></Field>
      </div>
      <p className="rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 text-[11px] leading-5 text-slate-500">Se Hubla e Hotmart estão em abas diferentes, crie uma conexão para cada uma e configure a taxa específica da plataforma. O Financeiro calcula entradas como Valor Venda menos essa taxa.</p>
      <SheetInspection state={inspectState} message={inspectMessage} columns={columns} />
    </div>
  );
}

function AdForm({ draft, onChange, inspectState, inspectMessage, columns }: { draft: AdAccountConfig; onChange: (draft: AdAccountConfig) => void; inspectState: InspectState; inspectMessage: string; columns: string[] }) {
  const updateUrl = (value: string) => onChange({ ...draft, spreadsheetUrl: value, gid: extractGid(value, draft.gid) });
  return <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_160px]"><Field label="Nome da conta"><input className={inputClass} value={draft.name} placeholder="Meta Ads principal" onChange={(event) => onChange({ ...draft, name: event.target.value })} /></Field><Field label="Plataforma"><select className={inputClass} value={draft.platform} onChange={(event) => onChange({ ...draft, platform: event.target.value })}><option>Meta Ads</option><option>Google Ads</option><option>TikTok Ads</option><option>LinkedIn Ads</option></select></Field><Field label="Status"><StatusSelect value={draft.status} onChange={(status) => onChange({ ...draft, status })} /></Field></div><Field label="URL da aba de anúncios"><UrlField value={draft.spreadsheetUrl} onChange={updateUrl} /></Field><SheetInspection state={inspectState} message={inspectMessage} columns={columns} /></div>;
}

function GenericSheetForm({ title, helper, draft, onChange, inspectState, inspectMessage, columns }: { title: string; helper: string; draft: GenericSheetConfig; onChange: (draft: GenericSheetConfig) => void; inspectState: InspectState; inspectMessage: string; columns: string[] }) {
  const updateUrl = (value: string) => onChange({ ...draft, spreadsheetUrl: value, gid: extractGid(value, draft.gid) });
  return <div className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_160px]"><Field label="Nome da fonte"><input className={inputClass} value={draft.name} placeholder={title} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></Field><Field label="Status"><StatusSelect value={draft.status} onChange={(status) => onChange({ ...draft, status })} /></Field></div><Field label="URL da aba"><UrlField value={draft.spreadsheetUrl} onChange={updateUrl} /></Field><p className="rounded-lg border border-slate-900 bg-slate-950/70 px-3 py-2 text-[11px] leading-5 text-slate-500">{helper} Cole a URL com a aba correta aberta. A aplicação lê todas as colunas automaticamente.</p><SheetInspection state={inspectState} message={inspectMessage} columns={columns} /></div>;
}


type InspectState = 'idle' | 'checking' | 'ready' | 'error';

function SheetInspection({ state, message, columns }: { state: InspectState; message: string; columns: string[] }) {
  return <div className={cn('rounded-xl border px-3 py-3 text-[11px]', state === 'error' ? 'border-rose-500/20 bg-rose-500/10 text-rose-200' : state === 'ready' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-950/70 text-slate-500')}><div className="flex items-center gap-2"><RefreshCw size={12} className={cn(state === 'checking' && 'animate-spin')} /><span>{message}</span></div>{columns.length > 0 && <p className="mt-2 text-[10px] text-slate-500">Colunas lidas automaticamente. Não precisa preencher nomes de colunas manualmente.</p>}</div>;
}

function extractGid(url: string, fallback = '0') {
  return url.match(/[?&#]gid=([0-9]+)/)?.[1] || fallback || '0';
}
function WebhookForm({
  draft,
  onChange,
  onTest,
  testState,
  message,
}: {
  draft: WebhookConfig;
  onChange: (draft: WebhookConfig) => void;
  onTest: () => void;
  testState: 'idle' | 'testing';
  message: string;
}) {
  return (
    <div className="space-y-4">
      <Field label="Nome"><input className={inputClass} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></Field>
      <Field label="URL"><input className={inputClass} value={draft.url} onChange={(event) => onChange({ ...draft, url: event.target.value })} /></Field>
      <Field label="Envio"><select className={inputClass} value={draft.cadence} onChange={(event) => onChange({ ...draft, cadence: event.target.value })}><option>Diário às 08:30</option><option>Diário às 18:00</option><option>Segunda, quarta e sexta</option><option>Manual</option></select></Field>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Toggle label="Incluir responsáveis" checked={draft.includeOwners} onChange={() => onChange({ ...draft, includeOwners: !draft.includeOwners })} />
        <Toggle label="Incluir prazos" checked={draft.includeDueDates} onChange={() => onChange({ ...draft, includeDueDates: !draft.includeDueDates })} />
      </div>
      <div className="rounded-xl border border-slate-900 bg-slate-950/70 p-3 text-[11px] leading-5 text-slate-500">
        O teste envia uma atividade exemplo para o n8n, no mesmo formato que a automação vai usar para mandar atividades abertas.
      </div>
      <button
        type="button"
        onClick={onTest}
        disabled={testState === 'testing' || !draft.url.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[11px] font-bold text-blue-300 transition-colors hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <BellRing size={13} className={cn(testState === 'testing' && 'animate-pulse')} />
        {testState === 'testing' ? 'Enviando teste' : 'Testar webhook com atividade'}
      </button>
      <p className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2 text-[11px] leading-5 text-amber-200">{message}</p>
    </div>
  );
}


function buildWebhookTestPayload(config: WebhookConfig) {
  const today = new Date().toISOString().slice(0, 10);
  const activity = {
    id: `test-${Date.now()}`,
    title: 'Atividade de teste do webhook',
    project: 'Simplicio Workspace',
    status: 'Em andamento',
    priority: 'Alta',
    owner: config.includeOwners ? 'Gustavo Correa' : undefined,
    ownerEmail: config.includeOwners ? 'gu.correa98@gmail.com' : undefined,
    dueDate: config.includeDueDates ? today : undefined,
    notes: 'Mensagem automática de teste enviada pela tela de Configurações.',
  };

  return {
    event: 'activity.test',
    source: 'simplicio-workspace',
    sentAt: new Date().toISOString(),
    webhook: {
      name: config.name,
      cadence: config.cadence,
    },
    activity,
    activities: [activity],
  };
}

function ConnectionRow({ item, index, canRemove, onEdit, onRemove }: { item: ConnectionItem; index: number; canRemove: boolean; onEdit: () => void; onRemove: () => void }) {
  const Icon = item.icon;
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }} className="grid grid-cols-[1.4fr_0.8fr_1fr_0.8fr_120px] items-center gap-4 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-blue-400"><Icon size={15} /></div><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-slate-300">{item.title}</p><p className="truncate text-[10px] text-slate-600">{item.subtitle}</p></div></div><span className="text-[11px] text-slate-500">{getTypeLabel(item.type)}</span><span className="truncate text-[11px] text-slate-500">{item.detail}</span><StatusPill status={item.status} label={item.status} /><div className="flex justify-end gap-1"><IconButton label="Editar" onClick={onEdit}><Edit3 size={13} /></IconButton>{canRemove && <IconButton label="Remover" onClick={onRemove}><Trash2 size={13} /></IconButton>}</div></motion.div>;
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
  if (mode === 'group') return `${action} dados do grupo`;
  if (mode === 'live') return `${action} dados da live`;
  return `${action} webhook`;
}

function getTypeLabel(type: ConnectionType) {
  if (type === 'sales') return 'Vendas';
  if (type === 'ads') return 'Anúncios';
  if (type === 'group') return 'Grupo';
  if (type === 'live') return 'Live';
  return 'Webhook';
}

function canSave(mode: ModalMode, sales: SalesSheetConfig, ad: AdAccountConfig, generic: GenericSheetConfig, webhook: WebhookConfig) {
  if (mode === 'sales') return Boolean(sales.platform.trim() && sales.spreadsheetUrl.trim() && sales.dateColumn.trim() && sales.revenueColumn.trim());
  if (mode === 'ads') return Boolean(ad.name.trim() && ad.spreadsheetUrl.trim() && ad.dateColumn.trim() && ad.spendColumn.trim());
  if (mode === 'group' || mode === 'live') return Boolean(generic.name.trim() && generic.spreadsheetUrl.trim());
  if (mode === 'webhook') return Boolean(webhook.name.trim() && webhook.url.trim());
  return false;
}
