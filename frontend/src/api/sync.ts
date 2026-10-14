const SYNC_BASE = '/mcnails/api/sync';

// evz_sync: publicación de resúmenes agregados hacia EsfuerzoVZ. Solo
// agregados del período — nunca nombres de clientas ni datos individuales
// (ver evz_backbone/evz_sync/collector.py).
//
// Ojo con los nombres: el backend lee `period_start`/`period_end` (en query
// para preview/status, en el body para publish). Con otro nombre los ignora
// en silencio y usa el mes anterior completo.

export interface SyncExpenseBreakdownItem {
  category: string;
  is_direct: boolean;
  amount: string;
  pct_of_expenses: number;
}

export interface SyncReport {
  schema_version: number;
  currency: string;
  period: { start: string; end: string };
  totals: { income: string; expenses: string };
  expense_breakdown: SyncExpenseBreakdownItem[];
  metrics: {
    customers_served: number;
    appointments: number;
    units_sold: number;
    orders: number;
    receipts_issued: number;
    avg_ticket: string;
  };
}

export interface SyncLogEntry {
  period_start: string;
  period_end: string;
  status: 'ok' | 'failed';
  http_status: number | null;
  error: string;
  sent_at: string;
  totals?: { income: string; expenses: string } | null;
}

export interface SyncRemoteStatus {
  available: boolean;
  reason?: string;
  detail?: string;
  [key: string]: unknown;
}

export interface SyncStatusResponse {
  remote: SyncRemoteStatus;
  suggested_period: { start: string; end: string };
  history: SyncLogEntry[];
}

export interface PublishSyncResult {
  status: string;
  period: { start: string; end: string };
  response: unknown;
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

async function handle<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || err?.detail || `${fallback} (${res.status})`);
  }
  return res.json();
}

export async function fetchSyncStatus(token: string): Promise<SyncStatusResponse> {
  const res = await fetch(`${SYNC_BASE}/status/`, { headers: authHeader(token) });
  return handle(res, 'No se pudo cargar el estado de sincronización');
}

export async function fetchSyncPreview(token: string, periodStart: string, periodEnd: string): Promise<SyncReport> {
  const params = new URLSearchParams({ period_start: periodStart, period_end: periodEnd });
  const res = await fetch(`${SYNC_BASE}/preview/?${params}`, { headers: authHeader(token) });
  return handle(res, 'No se pudo generar la vista previa');
}

export async function publishSync(token: string, periodStart: string, periodEnd: string): Promise<PublishSyncResult> {
  const res = await fetch(`${SYNC_BASE}/publish/`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
  });
  return handle(res, 'No se pudo publicar en EsfuerzoVZ');
}
