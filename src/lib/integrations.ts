import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from './firebase';
import { TRAFFIC_TAX_RATE, type FinanceExpense, type SalesRevenuePoint, type TrafficSpendPoint } from './finance';

export type ConnectionStatus = 'Ativa' | 'Pendente' | 'Erro';

export interface SalesSheetConfig {
  platform: string;
  spreadsheetUrl: string;
  sheetName: string;
  gid: string;
  dateColumn: string;
  revenueColumn: string;
  orderColumn: string;
  productColumn: string;
  statusColumn: string;
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

export interface IntegrationSettings {
  sales: SalesSheetConfig;
  adAccounts: AdAccountConfig[];
  webhook: WebhookConfig;
}

export interface SheetLoadResult {
  sales: SalesRevenuePoint[];
  traffic: TrafficSpendPoint[];
  trafficExpenses: FinanceExpense[];
  errors: string[];
}

export const defaultIntegrationSettings: IntegrationSettings = {
  sales: {
    platform: 'Vendas',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14cA1MmJXKVHOYILMXYdIguIWMjGknIgBwgC31Z5o5Bw/edit?gid=0#gid=0',
    sheetName: 'Página 1',
    gid: '0',
    dateColumn: 'data',
    revenueColumn: 'valor',
    orderColumn: '',
    productColumn: 'produto',
    statusColumn: 'status',
    status: 'Ativa',
  },
  adAccounts: [
    {
      id: 'meta-ads-principal',
      name: 'Meta Ads',
      platform: 'Meta Ads',
      accountId: '',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1P7EsItEUhVCeeLtpi6Iva48gVX_CszbpXdAy68aE-vk/edit?gid=0#gid=0',
      sheetName: 'Página 1',
      gid: '0',
      dateColumn: 'data',
      spendColumn: 'valor gasto',
      campaignColumn: 'campanha',
      status: 'Ativa',
    },
  ],
  webhook: {
    name: 'Atividades abertas - WhatsApp',
    url: '',
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

export async function loadSheetData(settings: IntegrationSettings): Promise<SheetLoadResult> {
  const errors: string[] = [];
  const sales = await loadSales(settings.sales).catch((error) => {
    errors.push(getErrorMessage('Vendas', error));
    return [] as SalesRevenuePoint[];
  });

  const trafficLists = await Promise.all(
    settings.adAccounts
      .filter((account) => account.status === 'Ativa' && account.spreadsheetUrl.trim())
      .map((account) => loadTraffic(account).catch((error) => {
        errors.push(getErrorMessage(account.name, error));
        return [] as TrafficSpendPoint[];
      })),
  );

  const traffic = trafficLists.flat();
  return {
    sales,
    traffic,
    trafficExpenses: traffic.map(toTrafficExpense),
    errors,
  };
}

async function loadSales(config: SalesSheetConfig): Promise<SalesRevenuePoint[]> {
  if (config.status !== 'Ativa' || !config.spreadsheetUrl.trim()) return [];
  const rows = await fetchRows(config.spreadsheetUrl, config.gid);
  return rows.map((row, index) => {
    const date = parseDate(readColumn(row, config.dateColumn, ['data', 'date', 'created_at', 'data da venda'])) || new Date().toISOString().slice(0, 10);
    const revenue = parseMoney(readColumn(row, config.revenueColumn, ['valor', 'receita', 'faturamento', 'valor líquido', 'valor liquido', 'total']));
    const orders = config.orderColumn ? Number(readColumn(row, config.orderColumn, ['pedidos', 'orders', 'vendas']) || 1) : 1;
    return {
      date,
      label: formatShortDate(date),
      revenue,
      orders: Number.isFinite(orders) && orders > 0 ? orders : 1,
      platform: readColumn(row, config.productColumn, ['produto', 'plataforma', 'product']) || config.platform || `Venda ${index + 1}`,
    };
  }).filter((point) => point.revenue > 0);
}

async function loadTraffic(config: AdAccountConfig): Promise<TrafficSpendPoint[]> {
  const rows = await fetchRows(config.spreadsheetUrl, config.gid);
  return rows.map((row) => {
    const date = parseDate(readColumn(row, config.dateColumn, ['data', 'date', 'dia'])) || new Date().toISOString().slice(0, 10);
    const spend = parseMoney(readColumn(row, config.spendColumn, ['valor gasto', 'gasto', 'investimento', 'spend', 'amount spent']));
    return {
      date,
      label: formatShortDate(date),
      account: config.name,
      platform: config.platform,
      spend,
    };
  }).filter((point) => point.spend > 0);
}

async function fetchRows(url: string, gid: string) {
  const response = await fetch(toCsvUrl(url, gid), { cache: 'no-store' });
  const text = await response.text();
  if (!response.ok || text.trim().startsWith('<!DOCTYPE html') || text.includes('document-root show-login-page')) {
    throw new Error('planilha privada ou sem publicação CSV');
  }
  return csvToRows(text);
}

export function toCsvUrl(url: string, gid = '0') {
  const id = url.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  const resolvedGid = url.match(/[?&#]gid=([0-9]+)/)?.[1] || gid || '0';
  if (!id) return url;
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${resolvedGid}`;
}

function csvToRows(csv: string) {
  const table = parseCsv(csv);
  const headers = (table.shift() ?? []).map(normalizeHeader);
  return table
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
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

function readColumn(row: Record<string, string>, preferred: string, alternatives: string[]) {
  const keys = [preferred, ...alternatives].map(normalizeHeader).filter(Boolean);
  const key = keys.find((item) => row[item] !== undefined);
  return key ? row[key] : '';
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const normalized = hasComma ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  return Number(normalized) || 0;
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
    notes: 'Saída automática gerada pela planilha de anúncios com acréscimo de imposto de 12,15%.',
    source: 'traffic',
  };
}

function mergeSettings(settings: Partial<IntegrationSettings>): IntegrationSettings {
  return {
    sales: { ...defaultIntegrationSettings.sales, ...settings.sales },
    adAccounts: settings.adAccounts?.length ? settings.adAccounts : defaultIntegrationSettings.adAccounts,
    webhook: { ...defaultIntegrationSettings.webhook, ...settings.webhook },
  };
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
