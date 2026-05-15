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
  document: string;
  location: string;
  paymentMethod: string;
  usefulFields: { label: string; value: string }[];
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
    const email = readEmail(row);
    const phone = readPhone(row);
    const fallback = `${readName(row) || 'lead'}-${index}`;
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
  const name = readName(latest) || 'Lead sem nome';
  const email = readEmail(latest);
  const phone = readPhone(latest);
  const status = readStatus(latest);
  const source = readSource(latest);
  const campaign = readCampaign(latest);
  const document = readDocument(latest);
  const location = readLocation(latest);
  const paymentMethod = readPaymentMethod(latest);
  const usefulFields = buildUsefulFields(latest);
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
    document,
    location,
    paymentMethod,
    usefulFields,
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
  return readSmartColumn(row, {
    aliases: ['produto', 'product', 'produto nome', 'nome produto', 'plataforma', 'offer', 'oferta', 'item', 'plano'],
    includes: ['produto', 'product', 'oferta', 'offer', 'item', 'plano'],
    excludes: ['id', 'codigo', 'código'],
  });
}

function readName(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['nome', 'name', 'cliente', 'comprador', 'nome comprador', 'customer name', 'nome completo', 'full name', 'buyer name', 'aluno'],
    includes: ['nome', 'name', 'cliente', 'comprador', 'customer', 'buyer', 'aluno'],
    excludes: ['produto', 'product', 'campanha', 'utm', 'status', 'metodo', 'método'],
  });
}

function readEmail(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['email', 'e-mail', 'mail', 'comprador email', 'email comprador', 'customer email', 'buyer email'],
    includes: ['email', 'mail'],
  });
}

function readPhone(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['telefone', 'celular', 'whatsapp', 'phone', 'comprador telefone', 'telefone comprador', 'customer phone', 'buyer phone'],
    includes: ['telefone', 'celular', 'whatsapp', 'phone', 'fone', 'contato'],
  });
}

function readStatus(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['status', 'situação', 'situacao', 'estado', 'pagamento', 'status pagamento', 'payment status'],
    includes: ['status', 'situacao', 'situação', 'pagamento', 'payment'],
    excludes: ['metodo', 'método', 'method'],
  });
}

function readSource(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['origem', 'source', 'utm_source', 'utm source', 'canal', 'utm origem'],
    includes: ['origem', 'source', 'canal', 'utm_source'],
  });
}

function readCampaign(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['campanha', 'campaign', 'utm_campaign', 'utm campaign', 'utm_content', 'utm content', 'anuncio', 'anúncio', 'criativo'],
    includes: ['campanha', 'campaign', 'utm_campaign', 'utm_content', 'anuncio', 'anúncio', 'criativo'],
  });
}

function readDocument(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['cpf', 'documento', 'document', 'doc', 'cnpj'],
    includes: ['cpf', 'documento', 'document', 'cnpj'],
  });
}

function readLocation(row: Record<string, string>) {
  const city = readSmartColumn(row, { aliases: ['cidade', 'city', 'município', 'municipio'], includes: ['cidade', 'city', 'municipio', 'município'] });
  const state = readSmartColumn(row, { aliases: ['estado', 'uf', 'state'], includes: ['estado', 'uf', 'state'], excludes: ['status'] });
  return [city, state].filter(Boolean).join(' / ');
}

function readPaymentMethod(row: Record<string, string>) {
  return readSmartColumn(row, {
    aliases: ['método pagamento', 'metodo pagamento', 'forma pagamento', 'payment method', 'payment_method', 'forma de pagamento'],
    includes: ['metodo', 'método', 'forma pagamento', 'payment_method', 'payment method'],
  });
}

function readDate(row: Record<string, string>) {
  return parseDate(readSmartColumn(row, {
    aliases: ['data', 'date', 'created_at', 'data da venda', 'data compra', 'created', 'data pedido', 'data de compra'],
    includes: ['data', 'date', 'created'],
    excludes: ['nascimento', 'birth'],
  }));
}

function readAmount(row: Record<string, string>) {
  return parseMoney(readSmartColumn(row, {
    aliases: ['valor', 'receita', 'faturamento', 'valor líquido', 'valor liquido', 'total', 'amount', 'price', 'preço', 'preco'],
    includes: ['valor', 'receita', 'faturamento', 'total', 'amount', 'price', 'preco', 'preço'],
    excludes: ['id', 'codigo', 'código'],
  }));
}

function buildUsefulFields(row: Record<string, string>) {
  const fields = [
    ['Documento', readDocument(row)],
    ['Localização', readLocation(row)],
    ['Pagamento', readPaymentMethod(row)],
    ['Status', readStatus(row)],
    ['Origem', readSource(row)],
    ['Campanha', readCampaign(row)],
  ];
  const detected = Object.entries(row)
    .filter(([key, value]) => value.trim() && /utm|cupom|checkout|transa|pedido|assinatura|afiliado|src|sck|fbclid|gclid/.test(key))
    .slice(0, 6)
    .map(([key, value]) => [toTitle(key), value] as [string, string]);
  return [...fields, ...detected]
    .filter(([, value], index, list) => value && list.findIndex(([, item]) => item === value) === index)
    .map(([label, value]) => ({ label, value }));
}

function readSmartColumn(row: Record<string, string>, config: { aliases?: string[]; includes?: string[]; excludes?: string[] }) {
  const aliases = (config.aliases ?? []).map(normalizeHeader);
  const includes = (config.includes ?? []).map(normalizeHeader);
  const excludes = (config.excludes ?? []).map(normalizeHeader);
  const keys = Object.keys(row);

  const exact = aliases.find((alias) => row[alias] !== undefined && String(row[alias]).trim());
  if (exact) return String(row[exact]).trim();

  const candidate = keys.find((key) => {
    if (!String(row[key]).trim()) return false;
    if (excludes.some((term) => key.includes(term))) return false;
    return includes.some((term) => key === term || key.includes(term) || term.includes(key));
  });
  return candidate ? String(row[candidate]).trim() : '';
}

function toTitle(value: string) {
  return value.split(/[_\s-]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
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
