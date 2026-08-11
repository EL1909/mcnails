const API_BASE = '/mcnails/api/treasury';
const SYNC_BASE = '/mcnails/api/sync';

export interface SummaryData {
  period: string;
  total_income: string;
  total_expenses: string;
  net_income: string;
  transaction_count: number;
  income_count: number;
  expense_count: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  is_direct: boolean;
}

export interface Transaction {
  id: number;
  direction: 'IN' | 'OUT';
  amount: string;
  date: string;
  description: string;
  category: number | null;
  method: string;
  order: number | null;
  created_at: string;
}

export async function fetchSummary(token: string, params?: Record<string, string>): Promise<SummaryData> {
  const query = new URLSearchParams(params || {}).toString();
  const url = query ? `${API_BASE}/summary/?${query}` : `${API_BASE}/summary/`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.statusText}`);
  return res.json();
}

export interface YearlyMonthSummary {
  month: number;
  income: string;
  expenses: string;
  balance: string;
}

export interface YearlySummaryData {
  year: number;
  months: YearlyMonthSummary[];
  total_income: string;
  total_expenses: string;
  total_balance: string;
}

export async function fetchYearlySummary(token: string, year: number): Promise<YearlySummaryData> {
  const res = await fetch(`${API_BASE}/summary/yearly/?year=${year}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch yearly summary: ${res.statusText}`);
  return res.json();
}

export async function fetchExpenseCategories(token: string): Promise<ExpenseCategory[]> {
  const query = new URLSearchParams().toString();
  const url = `${API_BASE}/categories/`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.statusText}`);
  return res.json();
}

export async function createExpenseCategory(
  token: string,
  name: string,
  isDirect: boolean
): Promise<ExpenseCategory> {
  const res = await fetch(`${API_BASE}/categories/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, is_direct: isDirect }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || `Failed to create category: ${res.statusText}`);
  }
  return res.json();
}

export async function updateTransactionCategory(
  token: string,
  transactionId: number,
  categoryId: number
): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/${transactionId}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category: categoryId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || `Failed to update category: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTransactions(token: string, params?: Record<string, string>): Promise<Transaction[]> {
  const query = new URLSearchParams(params || {}).toString();
  const url = query ? `${API_BASE}/transactions/?${query}` : `${API_BASE}/transactions/`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.statusText}`);
  return res.json();
}

export async function fetchMonthlyStats(token: string): Promise<SummaryData> {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const startDate = firstDay.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  return fetchSummary(token, {
    start: startDate,
    end: endDate,
  });
}

export interface OrderPaymentResult {
  payment: Transaction;
  balance_due: string;
  is_fully_paid: boolean;
}

export async function recordOrderPayment(
  token: string,
  orderId: number,
  amount?: string,
  method?: string
): Promise<OrderPaymentResult> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/payments/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...(amount ? { amount } : {}), ...(method ? { method } : {}) }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Failed to record payment: ${res.statusText}`);
  }
  return res.json();
}

export async function createTransaction(token: string, data: {
  direction: 'IN' | 'OUT';
  amount: string | number;
  date: string;
  description?: string;
  category?: number;
  method?: string;
}): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || error.non_field_errors?.[0] || `Failed to create transaction: ${res.statusText}`);
  }
  return res.json();
}

export async function syncToEVZ(token: string, periodStart?: string, periodEnd?: string): Promise<any> {
  const params = new URLSearchParams();
  if (periodStart) params.append('start', periodStart);
  if (periodEnd) params.append('end', periodEnd);

  const url = params.toString()
    ? `${SYNC_BASE}/publish/?${params.toString()}`
    : `${SYNC_BASE}/publish/`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Failed to sync with EVZ: ${res.statusText}`);
  }
  return res.json();
}
