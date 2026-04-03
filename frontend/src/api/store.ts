const API_BASE = '/api/store';

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  duration: string;
  category: number;
  category_name: string;
  image: string | null;
  is_active: boolean;
}

export interface OrderItemPayload {
  product_id: number;
  quantity?: number;
}

export interface OrderPayload {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  booking_date?: string;
  booking_time?: string;
  payment_method?: string;
  items: OrderItemPayload[];
}

export const fetchProducts = async (): Promise<Product[]> => {
  const res = await fetch(`${API_BASE}/products/`);
  if (!res.ok) throw new Error('Error al cargar los servicios');
  return res.json();
};

export const fetchCategories = async (): Promise<Category[]> => {
  const res = await fetch(`${API_BASE}/categories/`);
  if (!res.ok) throw new Error('Error al cargar las categorías');
  return res.json();
};

const authHeader = (token: string) => ({ 'Authorization': `Bearer ${token}` });

export interface Order {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  booking_date: string | null;
  booking_time: string | null;
  created_at: string;
  total: string;
  items: { id: number; product_name: string; quantity: number; price_at_purchase: string }[];
}

export const createProduct = async (token: string, data: FormData): Promise<Product> => {
  const res = await fetch(`${API_BASE}/products/`, {
    method: 'POST',
    headers: authHeader(token),
    body: data,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || `Error ${res.status} al crear el servicio`);
  }
  return res.json();
};

export const fetchAdminProducts = async (token: string): Promise<Product[]> => {
  const res = await fetch(`${API_BASE}/products/`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar productos');
  return res.json();
};

export const updateProduct = async (token: string, id: number, data: FormData): Promise<Product> => {
  const res = await fetch(`${API_BASE}/products/${id}/`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: data,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || `Error ${res.status} al actualizar`);
  }
  return res.json();
};

export const deleteProduct = async (token: string, id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/products/${id}/`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al eliminar el servicio');
};

export const fetchOrders = async (token: string): Promise<Order[]> => {
  const res = await fetch(`${API_BASE}/orders/`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar las órdenes');
  return res.json();
};

export const fetchAdminCategories = async (token: string): Promise<Category[]> => {
  const res = await fetch(`${API_BASE}/categories/`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar categorías');
  return res.json();
};

export const createCategory = async (token: string, name: string): Promise<Category> => {
  const res = await fetch(`${API_BASE}/categories/`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || `Error ${res.status} al crear la categoría`);
  }
  return res.json();
};

export const createOrder = async (payload: OrderPayload) => {
  const res = await fetch(`${API_BASE}/orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Error al crear la orden');
  return res.json();
};
