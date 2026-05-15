import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type ExpenseStatus = 'Aberta' | 'Paga';
export type ExpenseKind = 'Fixa' | 'Variável' | 'Imposto' | 'Investimento' | 'Tráfego importado';

export interface FinanceExpense {
  id: string;
  description: string;
  category: string;
  kind: ExpenseKind;
  amount: number;
  dueDate: string;
  paidDate: string;
  status: ExpenseStatus;
  isRecurring: boolean;
  paymentMethod: string;
  notes: string;
  source?: 'manual' | 'traffic';
  rawAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ExpenseDraft = Omit<FinanceExpense, 'id' | 'createdAt' | 'updatedAt' | 'source' | 'rawAmount' | 'taxAmount' | 'taxRate'>;

export interface SalesRevenuePoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  platform: string;
}

export interface TrafficSpendPoint {
  date: string;
  label: string;
  account: string;
  platform: string;
  spend: number;
  campaign: string;
  adSet: string;
  ad: string;
  impressions: number;
  clicks: number;
  leads: number;
  raw: Record<string, string>;
}


function makeTrafficPoint(point: Pick<TrafficSpendPoint, 'date' | 'label' | 'account' | 'platform' | 'spend'>): TrafficSpendPoint {
  return {
    ...point,
    campaign: '',
    adSet: '',
    ad: '',
    impressions: 0,
    clicks: 0,
    leads: 0,
    raw: {},
  };
}

export const TRAFFIC_TAX_RATE = 0.1215;
export const expenseKinds: ExpenseKind[] = ['Fixa', 'Variável', 'Imposto', 'Investimento', 'Tráfego importado'];
export const expenseStatuses: ExpenseStatus[] = ['Aberta', 'Paga'];
export const expenseCategories = ['Equipe', 'Tráfego', 'Ferramentas', 'Impostos', 'Operação', 'Conteúdo', 'Comissões', 'Outros'];

export const defaultRevenue: SalesRevenuePoint[] = [
  { date: '2026-05-01', label: '01 mai', revenue: 14200, orders: 42, platform: 'Hotmart' },
  { date: '2026-05-05', label: '05 mai', revenue: 18650, orders: 51, platform: 'Hotmart' },
  { date: '2026-05-09', label: '09 mai', revenue: 22100, orders: 63, platform: 'Kiwify' },
  { date: '2026-05-13', label: '13 mai', revenue: 17450, orders: 48, platform: 'Hotmart' },
  { date: '2026-05-17', label: '17 mai', revenue: 25880, orders: 70, platform: 'Eduzz' },
  { date: '2026-05-21', label: '21 mai', revenue: 19730, orders: 54, platform: 'Kiwify' },
  { date: '2026-05-25', label: '25 mai', revenue: 28600, orders: 77, platform: 'Hotmart' },
];

export const defaultTrafficSpend: TrafficSpendPoint[] = [
  makeTrafficPoint({ date: '2026-05-03', label: '03 mai', account: 'Meta Ads Principal', platform: 'Meta Ads', spend: 4200 }),
  makeTrafficPoint({ date: '2026-05-08', label: '08 mai', account: 'Google Search', platform: 'Google Ads', spend: 3150 }),
  makeTrafficPoint({ date: '2026-05-13', label: '13 mai', account: 'Meta Ads Principal', platform: 'Meta Ads', spend: 5100 }),
  makeTrafficPoint({ date: '2026-05-18', label: '18 mai', account: 'TikTok Remarketing', platform: 'TikTok Ads', spend: 2800 }),
  makeTrafficPoint({ date: '2026-05-23', label: '23 mai', account: 'Google Search', platform: 'Google Ads', spend: 3650 }),
];

export const defaultTrafficExpenses = defaultTrafficSpend.map((spend): FinanceExpense => {
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
});

export const defaultExpenses: FinanceExpense[] = [
  {
    id: 'local-fin-1',
    description: 'Gestor de tráfego',
    category: 'Equipe',
    kind: 'Fixa',
    amount: 6500,
    dueDate: '2026-05-10',
    paidDate: '2026-05-10',
    status: 'Paga',
    isRecurring: true,
    paymentMethod: 'Pix',
    notes: 'Mensalidade fixa da operação.',
    source: 'manual',
  },
  {
    id: 'local-fin-3',
    description: 'Assinaturas de ferramentas',
    category: 'Ferramentas',
    kind: 'Fixa',
    amount: 1850,
    dueDate: '2026-05-15',
    paidDate: '',
    status: 'Aberta',
    isRecurring: true,
    paymentMethod: 'Cartão',
    notes: 'CRM, automação e design.',
    source: 'manual',
  },
  {
    id: 'local-fin-4',
    description: 'Impostos estimados',
    category: 'Impostos',
    kind: 'Imposto',
    amount: 9200,
    dueDate: '2026-05-28',
    paidDate: '',
    status: 'Aberta',
    isRecurring: true,
    paymentMethod: 'Boleto',
    notes: '',
    source: 'manual',
  },
];

export const emptyExpenseDraft: ExpenseDraft = {
  description: '',
  category: 'Operação',
  kind: 'Variável',
  amount: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  paidDate: '',
  status: 'Aberta',
  isRecurring: false,
  paymentMethod: 'Pix',
  notes: '',
};

export function subscribeExpenses(onChange: (expenses: FinanceExpense[]) => void, onError: (error: FirestoreError) => void) {
  return onSnapshot(
    query(collection(db, 'financeExpenses'), orderBy('dueDate', 'asc')),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as FinanceExpense)),
    onError,
  );
}

export async function createExpense(expense: ExpenseDraft) {
  await addDoc(collection(db, 'financeExpenses'), {
    ...expense,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateExpense(id: string, expense: Partial<ExpenseDraft>) {
  await updateDoc(doc(db, 'financeExpenses', id), {
    ...expense,
    updatedAt: serverTimestamp(),
  });
}

export async function removeExpense(id: string) {
  await deleteDoc(doc(db, 'financeExpenses', id));
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
