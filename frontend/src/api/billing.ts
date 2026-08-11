const API_BASE = '/mcnails/api/billing';

export interface QuotationItem {
  id: number;
  product: number | null;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  subtotal: string;
  tax_amount: string;
  total: string;
}

export interface Quotation {
  id: number;
  number: string;
  issue_date: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_tax_id: string;
  notes: string;
  status: string;
  valid_until: string | null;
  order: number | null;
  items: QuotationItem[];
  subtotal: string;
  tax_amount: string;
  total: string;
}

export interface ReceiptItem {
  id: number;
  product: number | null;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  subtotal: string;
  tax_amount: string;
  total: string;
}

export interface Receipt {
  id: number;
  number: string;
  issue_date: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_tax_id: string;
  notes: string;
  issuer_legal_name: string;
  issuer_tax_id: string;
  issuer_address: string;
  country_code: string;
  currency: string;
  control_number: string;
  voided_at: string | null;
  void_reason: string;
  items: ReceiptItem[];
  subtotal: string;
  tax_amount: string;
  total: string;
}

export async function fetchQuotations(token: string): Promise<Quotation[]> {
  const res = await fetch(`${API_BASE}/quotations/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch quotations: ${res.statusText}`);
  return res.json();
}

export async function fetchReceipts(token: string): Promise<Receipt[]> {
  const res = await fetch(`${API_BASE}/receipts/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch receipts: ${res.statusText}`);
  return res.json();
}

export async function fetchBillingCounts(token: string): Promise<{ quotations: number; receipts: number; pending_quotations: number }> {
  const [quotations, receipts] = await Promise.all([
    fetchQuotations(token),
    fetchReceipts(token),
  ]);

  const pendingQuotations = quotations.filter(q => q.status === 'sent').length;

  return {
    quotations: quotations.length,
    receipts: receipts.length,
    pending_quotations: pendingQuotations,
  };
}

export async function updateQuotationStatus(token: string, quotationId: number, status: string): Promise<Quotation> {
  const res = await fetch(`${API_BASE}/quotations/${quotationId}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update quotation: ${res.statusText}`);
  return res.json();
}

export async function issueReceipt(token: string, orderId: number): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts/issue/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ order: orderId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to issue receipt: ${res.statusText}`);
  }
  return res.json();
}

export async function voidReceipt(token: string, receiptId: number, reason: string = ''): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts/${receiptId}/void/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to void receipt: ${res.statusText}`);
  return res.json();
}
