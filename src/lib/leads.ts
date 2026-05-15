import { type IntegrationSettings, toCsvUrl } from './integrations';

export type LeadTemperature = 'Quente' | 'Morno' | 'Frio';
export type LeadStage = 'Comprou Éden' | 'Comprou ingresso' | 'Outro produto';

export interface ScoredLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  product: string;
  status: string;
  amount: number;
  source: string;
  campaign: string;
  stage: LeadStage;
  score: number;
  temperature: LeadTemperature;
  signals: string[];
  raw: Record<string, string>;
}

export interface LeadLoadResult {
  leads: ScoredLead[];
  errors: string[];
  columns: string[];
}

export async function loadLeadScoreData(settings: IntegrationSettings): Promise<LeadLoadResult> {
  const errors: string[] = [];
  if (settings.sales.status !== 'Ativa' || !settings.sales.spreadsheetUrl.trim()) {
    return { leads: [], errors: ['Conexão de vendas inativa.'], columns: [] };
  }

  const rows = await fetchRows(settings.sales.spreadsheetUrl, settings.sales.gid).catch((error) => {
    errors.push(error instanceof Error ? error.message : 'erro desconhecido ao carregar leads');
    return [] as Record<string, string>[];
  });

  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const grouped = new Map<string, Record<string, string>[]>();
  rows.forEach((row, index) => {
    const email = readColumn(row, ['email', 'e-mail', 'mail', 'comprador email', 'email comprador']);
    const phone = readColumn(row, ['telefone', 'celular', 'whatsapp', 'phone', 'comprador telefone']);
    const fallback = `${readColumn(row, ['nome', 'name', 'cliente', 'comprador']) || 'lead'}-${index}`;
    const key = normalizeKey(email || phone || fallback);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  const leads = Array.from(grouped.entries())
    .map(([id, purchases]) => scoreLead(id, purchases))
    .sort((a, b) => b.score - a.score || b.amount - a.amount);

  return { leads, errors, columns };
}

function scoreLead(id: string, purchases: Record<string, string>[]): ScoredLead {
  const latest = purchases.slice().sort((a, b) => readDate(b).localeCompare(readDate(a)))[0] ?? {};
  const products = purchases.map(readProduct).filter(Boolean);
  const hasWorkshop = products.some(isWorkshopProduct);
  const hasEden = products.some(isEdenProduct);
  const amount = sum(purchases.map(readAmount));
  const name = readColumn(latest, ['nome', 'name', 'cliente', 'comprador', 'nome comprador', 'customer name']) || 'Lead sem nome';
  const email = readColumn(latest, ['email', 'e-mail', 'mail', 'comprador email', 'email comprador']);
  const phone = readColumn(latest, ['telefone', 'celular', 'whatsapp', 'phone', 'comprador telefone']);
  const status = readColumn(latest, ['status', 'situação', 'situacao', 'estado', 'pagamento']);
  const source = readColumn(latest, ['origem', 'source', 'utm_source', 'utm source', 'canal']);
  const campaign = readColumn(latest, ['campanha', 'campaign', 'utm_campaign', 'utm campaign', 'utm_content', 'utm content']);
  const product = readProduct(latest) || products[0] || 'Produto não identificado';
  const signals: string[] = [];
  let score = 20;

  if (hasWorkshop) add(28, 'Comprou ingresso do workshop');
  if (hasEden) add(45, 'Já comprou a comunidade Éden');
  if (isPaidStatus(status)) add(10, 'Pagamento aprovado/confirmado');
  if (email) add(5, 'E-mail disponível');
  if (phone) add(8, 'WhatsApp/telefone disponível');
  if (source || campaign) add(7, 'Origem ou campanha identificada');
  if (amount >= 100) add(7, 'Ticket acima do ingresso básico');
  if (purchases.length > 1) add(10, 'Possui mais de uma compra no histórico');

  const intent = inferIntent(latest);
  if (intent.length) {
    add(8, `Sinais de intenção: ${intent.join(', ')}`);
  }

  if (!hasWorkshop && !hasEden) {
    score = Math.min(score, 55);
    signals.push('Ainda não está no funil workshop > live > Éden');
  }

  score = clamp(Math.round(score), 0, 100);
  const temperature: LeadTemperature = score >= 75 ? 'Quente' : score >= 45 ? 'Morno' : 'Frio';
  const stage: LeadStage = hasEden ? 'Comprou Éden' : hasWorkshop ? 'Comprou ingresso' : 'Outro produto';

  return {
    id,
    name,
    email,
    phone,
    date: readDate(latest),
    product,
    status,
    amount,
    source,
    campaign,
    stage,
    score,
    temperature,
    signals: signals.slice(0, 5),
    raw: latest,
  };

  function add(points: number, signal: string) {
    score += points;
    signals.push(signal);
  }
}

async function fetchRows(url: string, gid: string) {
  const response = await fetch(toCsvUrl(url, gid), { cache: 'no-store' });
  const text = await response.text();
  if (!response.ok || text.trim().startsWith('<!DOCTYPE html') || text.includes('document-root show-login-page')) {
    throw new Error('Planilha de vendas privada ou sem publicação CSV.');
  }
  return csvToRows(text);
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

function readProduct(row: Record<string, string>) {
  return readColumn(row, ['produto', 'product', 'produto nome', 'nome produto', 'plataforma', 'offer', 'oferta']);
}

function readDate(row: Record<string, string>) {
  return parseDate(readColumn(row, ['data', 'date', 'created_at', 'data da venda', 'data compra', 'created']));
}

function readAmount(row: Record<string, string>) {
  return parseMoney(readColumn(row, ['valor', 'receita', 'faturamento', 'valor líquido', 'valor liquido', 'total', 'amount', 'price']));
}

function readColumn(row: Record<string, string>, options: string[]) {
  const keys = options.map(normalizeHeader);
  const key = keys.find((item) => row[item] !== undefined && String(row[item]).trim());
  return key ? String(row[key]).trim() : '';
}

function inferIntent(row: Record<string, string>) {
  const text = Object.entries(row)
    .filter(([key]) => /dor|objetivo|motivo|desafio|resposta|pergunta|observa|utm|campanha|produto/.test(key))
    .map(([, value]) => value)
    .join(' ')
    .toLowerCase();
  const matches: string[] = [];
  if (/cura|curar|terapia|terapeut|emocional/.test(text)) matches.push('cura/terapia');
  if (/ansiedade|depress|medo|trauma|bloqueio/.test(text)) matches.push('dor emocional');
  if (/comunidade|eden|éden|mentoria|acompanha/.test(text)) matches.push('interesse no Éden');
  if (/urgente|preciso|quero|hoje|agora/.test(text)) matches.push('urgência');
  return matches;
}

function isWorkshopProduct(product: string) {
  const value = product.toLowerCase();
  return /workshop|bussola|bússola|ingresso|aula|live/.test(value);
}

function isEdenProduct(product: string) {
  const value = product.toLowerCase();
  return /eden|éden|comunidade/.test(value);
}

function isPaidStatus(status: string) {
  return /aprov|pago|paid|confirm|completo|complete/.test(status.toLowerCase());
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

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeKey(value: string) {
  return normalizeHeader(value).replace(/[^a-z0-9@._+-]+/g, '-');
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
