const API_BASE = '/mcnails/api/business';

export interface BusinessIdentity {
  legal_name: string;
  trade_name: string;
  tax_id: string;
  logo: string | null;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  currency: string;
}

// Identidad por defecto: si el backend no responde, la página sigue usable
// en vez de mostrarse en blanco.
export const FALLBACK_IDENTITY: BusinessIdentity = {
  legal_name: '',
  trade_name: 'MC Nails',
  tax_id: '',
  logo: null,
  address: '',
  city: '',
  country: '',
  email: '',
  phone: '',
  currency: 'EUR',
};

export async function fetchBusinessIdentity(): Promise<BusinessIdentity> {
  const res = await fetch(`${API_BASE}/`);
  if (!res.ok) throw new Error('No se pudo cargar la identidad de la empresa');
  return res.json();
}
