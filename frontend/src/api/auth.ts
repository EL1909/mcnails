const API_BASE = '/mcnails/api/accounts';

const authHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const login = async (identifier: string, password: string) => {
  const res = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error('Credenciales incorrectas');
  return res.json(); // { access, refresh }
};

export const register = async (data: {
  email?: string;
  phone?: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
}) => {
  const res = await fetch(`${API_BASE}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ');
    throw new Error(msg || 'Error al registrarse');
  }
  return res.json(); // { user, access, refresh }
};

export const fetchProfile = async (token: string) => {
  const res = await fetch(`${API_BASE}/profile/`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Sesión expirada');
  return res.json();
};

export interface ClientUser {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  notes: string;
  is_verified: boolean;
  date_joined: string;
}

export const fetchUsers = async (token: string): Promise<ClientUser[]> => {
  const res = await fetch(`${API_BASE}/users/`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Error al cargar usuarios');
  return res.json();
};

export const adminCreateUser = async (
  token: string,
  data: { first_name?: string; last_name?: string; email?: string; phone?: string; notes?: string }
): Promise<ClientUser> => {
  const res = await fetch(`${API_BASE}/users/create/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.values(err).flat().join(' ');
    throw new Error(msg || 'Error al crear cliente');
  }
  return res.json();
};

export const adminUpdateUser = async (
  token: string,
  id: string,
  data: { first_name?: string; last_name?: string; email?: string; phone?: string; notes?: string }
): Promise<ClientUser> => {
  const res = await fetch(`${API_BASE}/users/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar cliente');
  return res.json();
};

export const requestPasswordReset = async (email: string) => {
  const res = await fetch(`${API_BASE}/password-reset/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Error al enviar el email');
  return res.json();
};

export const confirmPasswordReset = async (uid: string, token: string, new_password1: string, new_password2: string) => {
  const res = await fetch(`${API_BASE}/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, token, new_password1, new_password2 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al restablecer la contraseña');
  }
  return res.json();
};

export const updateProfile = async (token: string, data: FormData | object) => {
  const isFormData = data instanceof FormData;
  const res = await fetch(`${API_BASE}/profile/`, {
    method: 'PATCH',
    headers: isFormData
      ? { 'Authorization': `Bearer ${token}` }
      : authHeaders(token),
    body: isFormData ? data : JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar perfil');
  return res.json();
};
