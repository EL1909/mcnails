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

export interface TeamMemberPublic {
  id: number;
  display_name: string;
  photo: string | null;
  bio: string;
}

export async function fetchTeamMembers(): Promise<TeamMemberPublic[]> {
  const res = await fetch(`${API_BASE}/team/`);
  if (!res.ok) throw new Error('No se pudo cargar el equipo');
  return res.json();
}

export interface TeamMemberAdmin {
  id: number;
  display_name: string;
  email: string;
  photo: string | null;
  bio: string;
  is_active: boolean;
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

// Quién soy dentro del equipo: null si la cuenta es admin puro (superuser
// sin perfil de equipo propio). El panel lo usa para decidir si alguien ve
// solo su agenda o la de todo el equipo.
export async function fetchMyTeamMember(token: string): Promise<TeamMemberAdmin | null> {
  const res = await fetch(`${API_BASE}/team/me/`, { headers: authHeader(token) });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error('No se pudo cargar tu perfil de equipo');
  return res.json();
}

// Incluye inactivas — solo la dueña (superuser) puede llamar esto.
export async function fetchAllTeamMembers(token: string): Promise<TeamMemberAdmin[]> {
  const res = await fetch(`${API_BASE}/team-members/`, { headers: authHeader(token) });
  if (!res.ok) throw new Error('No se pudo cargar el equipo');
  return res.json();
}

export async function createTeamMember(token: string, data: {
  email: string;
  password: string;
  display_name: string;
  bio?: string;
  photo?: File;
}): Promise<TeamMemberAdmin> {
  const form = new FormData();
  form.append('email', data.email);
  form.append('password', data.password);
  form.append('display_name', data.display_name);
  if (data.bio) form.append('bio', data.bio);
  if (data.photo) form.append('photo', data.photo);

  const res = await fetch(`${API_BASE}/team-members/`, {
    method: 'POST',
    headers: authHeader(token),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || 'Error al crear el miembro del equipo');
  }
  return res.json();
}

export async function updateTeamMember(
  token: string,
  id: number,
  data: Partial<{ display_name: string; bio: string; is_active: boolean; photo: File }>
): Promise<TeamMemberAdmin> {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) form.append(k, v instanceof File ? v : String(v));
  });
  const res = await fetch(`${API_BASE}/team-members/${id}/`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: form,
  });
  if (!res.ok) throw new Error('Error al actualizar el miembro del equipo');
  return res.json();
}
