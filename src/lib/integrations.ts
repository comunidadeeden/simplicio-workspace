import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { defaultCycleSettings, type CycleSettings } from './cycles';
import { TRAFFIC_TAX_RATE, type FinanceExpense, type SalesRevenuePoint, type TrafficSpendPoint } from './finance';

export type ConnectionStatus = 'Ativa' | 'Pendente' | 'Erro';

export interface SalesSheetConfig {
  id: string;
  platform: string;
  spreadsheetUrl: string;
  sheetName: string;
  gid: string;
  dateColumn: string;
  revenueColumn: string;
  orderColumn: string;
  productColumn: string;
  statusColumn: string;
  platformFeeRate: number;
  status: ConnectionStatus;
}

export interface AdAccountConfig {
  id: string;
  name: string;
  platform: string;
  accountId: string;
  spreadsheetUrl: string;
  sheetName: string;
  gid: string;
  dateColumn: string;
  spendColumn: string;
  campaignColumn: string;
  status: ConnectionStatus;
}

export interface WebhookConfig {
  name: string;
  url: string;
  cadence: string;
  includeOwners: boolean;
  includeDueDates: boolean;
}

export interface GenericSheetConfig {
  id: string;
  name: string;
  spreadsheetUrl: string;
  sheetName: string;
  gid: string;
  status: ConnectionStatus;
}

export interface IntegrationSettings {
  salesSources: SalesSheetConfig[];
  sales?: SalesSheetConfig;
  adAccounts: AdAccountConfig[];
  groupSources: GenericSheetConfig[];
  liveSources: GenericSheetConfig[];
  cycle: CycleSettings;
  webhook: WebhookConfig;
}


export interface SheetInspectionResult {
  columns: string[];
  rowCount: number;
  detected: Partial<SalesSheetConfig & AdAccountConfig>;
}

export interface SheetLoadResult {
  sales: SalesRevenuePoint[];
  traffic: TrafficSpendPoint[];
  groups: Record<string, string>[];
  lives: Record<string, string>[];
  trafficExpenses: FinanceExpense[];
  errors: string[];
}

export const defaultSalesSource: SalesSheetConfig = {
  id: 'sales-principal',
  platform: 'Vendas',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14cA1MmJXKVHOYILMXYdIguIWMjGknIgBwgC31Z5o5Bw/edit?gid=0#gid=0',
  sheetName: 'Página 1',
  gid: '0',
  dateColumn: 'data',
  revenueColumn: 'Valor Venda',
  orderColumn: '',
  productColumn: 'produto',
  statusColumn: 'status',
  platformFeeRate: 0,
  status: 'Ativa',
};

export const defaultGenericSheet: GenericSheetConfig = {
  id: '',
  name: '',
  spreadsheetUrl: '',
  sheetName: 'Página 1',
  gid: '0',
  status: 'Ativa',
};

export const defaultIntegrationSettings: IntegrationSettings = {
  salesSources: [{ ...defaultSalesSource }],
  adAccounts: [
    {
      id: 'meta-ads-principal',
      name: 'Meta Ads',
      platform: 'Meta Ads',
      accountId: '',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1P7EsItEUhVCeeLtpi6Iva48gVX_CszbpXdAy68aE-vk/edit?gid=0#gid=0',
      sheetName: 'Página 1',
      gid: '0',
      dateColumn: 'Day',
      spendColumn: 'Amount Spent',
      campaignColumn: 'Campaign Name',
      status: 'Ativa',
    },
  ],
  groupSources: [],
  liveSources: [],
  cycle: defaultCycleSettings,
  webhook: {
    name: 'Atividades abertas - WhatsApp',
    url: 'https://n8n.vps1171.panel.speedfy.host/webhook/tasks',
    cadence: 'Diário às 08:30',
    includeOwners: true,
    includeDueDates: true,
  },
};

const settingsRef = doc(collection(db, 'integrationSettings'), 'main');

export function subscribeIntegrationSettings(
  onChange: (settings: IntegrationSettings) => void,
  onError: (error: FirestoreError) => void,
) {
  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(defaultIntegrationSettings);
        return;
      }
      onChange(mergeSettings(snapshot.data() as Partial<IntegrationSettings>));
    },
    onError,
  );
}

export async function saveIntegrationSettings(settings: IntegrationSettings) {
  await setDoc(settingsRef, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

export async function inspectSheetConnection(type: 'sales' | 'ads' | 'generic', url: string, gid: string): Promise<SheetInspectionResult> {
  const { columns, rows } = await fetchSheetTable(url, gid);
  return {
    columns,
    rowCount: rows.length,
    detected: type === 'ads' ? detectAdColumns(columns) : type === 'sales' ? detectSalesColumns(columns) : {},
  };
}

export async function loadSheetData(settings: IntegrationSettings): Promise<SheetLoadResult> {
  const errors: string[] = [];
  const salesLists = await Promise.all(
    settings.salesSources
      .filter((source) => source.status === 'Ativa' && source.spreadsheetUrl.trim())
      .map((source) => loadSales(source).catch((error) => {
        errors.push(getErrorMessage(source.platform || 'Vendas', error));
        return [] as SalesRevenuePoint[];
      })),
  );

  const trafficLists = await Promise.all(
    settings.adAccounts
      .filter((account) => account.status === 'Ativa' && account.spreadsheetUrl.trim())
      .map((account) => loadTraffic(account).catch((error) => {
        errors.push(getErrorMessage(account.name, error));
        return [] as TrafficSpendPoint[];
      })),
  );

  const groupLists = await Promise.all(
    settings.groupSources
      .filter((source) => source.status === 'Ativa' && source.spreadsheetUrl.trim())
      .map((source) => loadGenericSheet(source).catch((error) => {
        errors.push(getErrorMessage(source.name || 'Grupo', error));
        return [] as Record<string, string>[];
      })),
  );

  const liveLists = await Promise.all(
    settings.liveSources
      .filter((source) => source.status === 'Ativa' && source.spreadsheetUrl.trim())
      .map((source) => loadGenericSheet(source).catch((error) => {
        errors.push(getErrorMessage(source.name || 'Live', error));
        return [] as Record<string, string>[];
      })),
  );

  const traffic = trafficLists.flat();
  return {
    sales: salesLists.flat(),
    traffic,
    groups: groupLists.flat(),
    lives: liveLists.flat(),
    trafficExpenses: traffic.map(toTrafficExpense),
    errors,
  };
}

async function loadSales(config: SalesSheetConfig): Promise<SalesRevenuePoint[]> {
  if (config.status !== 'Ativa' || !config.spreadsheetUrl.trim()) return [];
  const rows = await fetchRows(config.spreadsheetUrl, config.gid);
  return rows.map((row, index) => {
    const dateValue = readColumn(row, config.dateColumn, ['data', 'date', 'created_at', 'data da venda']);
    const timeValue = readColumn(row, '', ['hora', 'horário', 'horario', 'hora venda', 'hora da venda', 'time']);
    const date = parseDate(dateValue) || new Date().toISOString().slice(0, 10);
    const occurredAt = parseDateTime(dateValue, timeValue);
    const grossRevenue = parseMoney(readColumn(row, config.revenueColumn, ['valor venda', 'valor da venda', 'valor', 'receita', 'faturamento', 'valor líquido', 'valor liquido', 'total']));
    const platformFeeRate = normalizeRate(config.platformFeeRate);
    const platformFeeAmount = roundCurrency(grossRevenue * platformFeeRate);
    const netRevenue = roundCurrency(grossRevenue - platformFeeAmount);
    const orders = config.orderColumn ? Number(readColumn(row, config.orderColumn, ['pedidos', 'orders', 'vendas']) || 1) : 1;
    return {
      date,
      label: formatShortDate(date),
      revenue: grossRevenue,
      grossRevenue: grossRevenue || undefined,
      platformFeeRate,
      platformFeeAmount: platformFeeAmount || undefined,
      netRevenue: netRevenue || undefined,
      orders: Number.isFinite(orders) && orders > 0 ? orders : 1,
      platform: readColumn(row, config.productColumn, ['produto', 'plataforma', 'product']) || config.platform || `Venda ${index + 1}`,
      occurredAt,
    };
  }).filter((point) => point.revenue > 0);
}

async function loadGenericSheet(config: GenericSheetConfig) {
  return fetchRows(config.spreadsheetUrl, config.gid);
}

async function loadTraffic(config: AdAccountConfig): Promise<TrafficSpendPoint[]> {
  const rows = await fetchRows(config.spreadsheetUrl, config.gid);
  return rows.map((row) => {
    const date = parseDate(readColumn(row, config.dateColumn, adColumnAliases.date)) || new Date().toISOString().slice(0, 10);
    const spend = parseMoney(readColumn(row, config.spendColumn, adColumnAliases.spend));
    const campaign = readColumn(row, config.campaignColumn, adColumnAliases.campaign);
    const results = parseNumber(readColumn(row, '', adColumnAliases.results));
    return {
      date,
      label: formatShortDate(date),
      account: config.name,
      platform: config.platform,
      spend,
      campaign,
      adSet: readColumn(row, '', adColumnAliases.adSet),
      ad: readColumn(row, '', adColumnAliases.ad),
      reach: parseNumber(readColumn(row, '', adColumnAliases.reach)),
      impressions: parseNumber(readColumn(row, '', adColumnAliases.impressions)),
      frequency: parseNumber(readColumn(row, '', adColumnAliases.frequency)),
      results,
      costPerResult: parseMoney(readColumn(row, '', adColumnAliases.costPerResult)),
      cpm: parseMoney(readColumn(row, '', adColumnAliases.cpm)),
      clicks: parseNumber(readColumn(row, '', adColumnAliases.clicks)),
      cpc: parseMoney(readColumn(row, '', adColumnAliases.cpc)),
      ctr: parseNumber(readColumn(row, '', adColumnAliases.ctr)),
      leads: results || parseNumber(readColumn(row, '', adColumnAliases.leads)),
      raw: row,
    };
  }).filter((point) => point.spend > 0);
}

async function fetchRows(url: string, gid: string) {
  const { rows } = await fetchSheetTable(url, gid);
  return rows;
}

async function fetchSheetTable(url: string, gid: string) {
  const response = await fetch(toCsvUrl(url, gid), { cache: 'no-store' });
  const text = await response.text();
  if (!response.ok || text.trim().startsWith('<!DOCTYPE html') || text.includes('document-root show-login-page')) {
    throw new Error('planilha privada ou sem publicação CSV');
  }
  return csvToTable(text);
}

export function toCsvUrl(url: string, gid = '0') {
  const id = url.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  const resolvedGid = url.match(/[?&#]gid=([0-9]+)/)?.[1] || gid || '0';
  if (!id) return url;
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${resolvedGid}`;
}

function csvToTable(csv: string) {
  const table = parseCsv(csv);
  const columns = table.shift() ?? [];
  const headers = columns.map(normalizeHeader);
  const rows = table
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  return { columns: columns.map((column) => column.trim()).filter(Boolean), rows };
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}


const salesColumnAliases = {
  date: ['data', 'date', 'created_at', 'data venda', 'data da venda', 'data compra', 'data pedido', 'data de compra', 'purchase date', 'sale date'],
  revenue: ['valor venda', 'valor da venda', 'valor', 'receita', 'faturamento', 'valor líquido', 'valor liquido', 'total', 'amount', 'price', 'preço', 'preco', 'sale amount'],
  order: ['pedidos', 'orders', 'vendas', 'pedido', 'order id', 'id pedido', 'transaction', 'transacao', 'transação', 'codigo venda', 'código venda'],
  product: ['produto', 'product', 'produto nome', 'nome produto', 'plataforma', 'offer', 'oferta', 'item', 'plano'],
  status: ['status', 'situação', 'situacao', 'estado', 'pagamento', 'status pagamento', 'payment status', 'metodo pagamento', 'método pagamento'],
};

const adColumnAliases = {
  date: ['Day', 'data', 'date', 'dia', 'day'],
  campaign: ['Campaign Name', 'campanha', 'campaign', 'nome da campanha'],
  adSet: ['Ad Set Name', 'conjunto de anuncios', 'conjunto de anúncios', 'ad set', 'adset', 'nome do conjunto'],
  ad: ['Ad Name', 'anuncio', 'anúncio', 'ad', 'nome do anuncio', 'nome do anúncio'],
  reach: ['Reach', 'alcance'],
  impressions: ['Impressions', 'impressoes', 'impressões'],
  frequency: ['Frequency', 'frequencia', 'frequência'],
  results: ['Results', 'resultados', 'leads', 'conversoes', 'conversões'],
  costPerResult: ['Cost per Result', 'custo por resultado', 'cost per result'],
  spend: ['Amount Spent', 'valor gasto', 'gasto', 'investimento', 'spend', 'amount spent', 'valor usado'],
  cpm: ['CPM (Cost per 1,000 Impressions)', 'cpm', 'cost per 1,000 impressions'],
  clicks: ['Link Clicks', 'cliques no link', 'link clicks', 'cliques', 'clicks'],
  cpc: ['CPC (Cost per Link Click)', 'cpc', 'cost per link click'],
  ctr: ['CTR (Link Click-Through Rate)', 'ctr', 'link click-through rate'],
  leads: ['Results', 'leads', 'cadastros', 'inscricoes', 'inscrições', 'conversoes', 'conversões'],
};

function detectSalesColumns(columns: string[]): Partial<SalesSheetConfig> {
  return {
    dateColumn: findColumn(columns, salesColumnAliases.date),
    revenueColumn: findColumn(columns, salesColumnAliases.revenue),
    orderColumn: findColumn(columns, salesColumnAliases.order),
    productColumn: findColumn(columns, salesColumnAliases.product),
    statusColumn: findColumn(columns, salesColumnAliases.status),
  };
}

function detectAdColumns(columns: string[]): Partial<AdAccountConfig> {
  return {
    dateColumn: findColumn(columns, adColumnAliases.date),
    spendColumn: findColumn(columns, adColumnAliases.spend),
    campaignColumn: findColumn(columns, adColumnAliases.campaign),
  };
}

function findColumn(columns: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return columns.find((column) => normalizedAliases.includes(normalizeHeader(column))) || '';
}

function readColumn(row: Record<string, string>, preferred: string, alternatives: string[]) {
  const keys = [preferred, ...alternatives].map(normalizeHeader).filter(Boolean);
  const key = keys.find((item) => row[item] !== undefined);
  return key ? row[key] : '';
}

function parseMoney(value: string) {
  return parseFlexibleNumber(value);
}

function parseNumber(value: string) {
  return parseFlexibleNumber(value);
}

function parseFlexibleNumber(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
    return Number(normalized) || 0;
  }
  if (lastComma >= 0) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(cleaned) || 0;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const br = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}


function parseDateTime(value: string, timeValue = '') {
  const trimmed = value.trim();
  const time = normalizeTime(timeValue);
  if (!trimmed) return '';
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2})(?::\d{2})?)?/);
  if (iso) return iso[2] || time ? `${iso[1]}T${iso[2] || time}:00` : '';
  const br = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}:\d{2})(?::\d{2})?)?/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const rowTime = br[4] || time;
    return rowTime ? `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}T${rowTime}:00` : '';
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) || (!/\d{1,2}:\d{2}/.test(trimmed) && !time) ? '' : parsed.toISOString();
}

function normalizeTime(value: string) {
  const match = value.trim().match(/(\d{1,2})[:h](\d{2})/i);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

function toTrafficExpense(spend: TrafficSpendPoint): FinanceExpense {
  const taxAmount = roundCurrency(spend.spend * TRAFFIC_TAX_RATE);
  return {
    id: `traffic-${spend.date}-${spend.account.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    description: `${spend.platform} - ${spend.account}`,
    category: 'Tráfego',
    kind: 'Tráfego importado',
    amount: roundCurrency(spend.spend + taxAmount),
    rawAmount: spend.spend,
    taxAmount,
    taxRate: TRAFFIC_TAX_RATE,
    dueDate: spend.date,
    paidDate: spend.date,
    status: 'Paga',
    isRecurring: false,
    paymentMethod: 'Planilha de tráfego',
    notes: 'Saída automática gerada pela planilha de anúncios com acréscimo de imposto de 13,83%.',
    source: 'traffic',
  };
}

function mergeSettings(settings: Partial<IntegrationSettings>): IntegrationSettings {
  return {
    salesSources: normalizeSalesSources(settings),
    adAccounts: settings.adAccounts?.length ? settings.adAccounts : defaultIntegrationSettings.adAccounts,
    groupSources: normalizeGenericSources(settings.groupSources),
    liveSources: normalizeGenericSources(settings.liveSources),
    cycle: { ...defaultCycleSettings, ...settings.cycle },
    webhook: { ...defaultIntegrationSettings.webhook, ...settings.webhook, url: settings.webhook?.url || defaultIntegrationSettings.webhook.url },
  };
}

function normalizeGenericSources(sources?: GenericSheetConfig[]) {
  return (sources ?? []).map((source, index) => ({
    ...defaultGenericSheet,
    ...source,
    id: source.id || `sheet-${index + 1}`,
  }));
}

function normalizeSalesSources(settings: Partial<IntegrationSettings>): SalesSheetConfig[] {
  const sources = settings.salesSources?.length
    ? settings.salesSources
    : settings.sales
      ? [settings.sales]
      : defaultIntegrationSettings.salesSources;

  return sources.map((source, index) => ({
    ...defaultSalesSource,
    ...source,
    platformFeeRate: normalizeRate(source.platformFeeRate),
    id: source.id || (index === 0 ? 'sales-principal' : `sales-${index + 1}`),
  }));
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function getErrorMessage(source: string, error: unknown) {
  return `${source}: ${error instanceof Error ? error.message : 'erro desconhecido'}`;
}

function normalizeRate(value?: number) {
  const numeric = Number(value) || 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
