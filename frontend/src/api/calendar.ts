const API_BASE = '/api/calendars';

export interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

export interface AvailabilityResponse {
  date: string;
  slot_minutes: number;
  slots: TimeSlot[];
}

export interface AppointmentPayload {
  product?: number;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  start_time: string;
  end_time: string;
  notes?: string;
  order?: number;
}

export interface Appointment {
  id: number;
  product: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
  google_event_id: string;
  created_at: string;
  order: number | null;
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  color: string;
  extendedProps: {
    customer_email: string;
    customer_phone: string;
    status: string;
    notes: string;
    order_id: number | null;
  };
}

export interface CalendarSettings {
  id: number;
  google_calendar_id: string;
  buffer_minutes: number;
  working_hours_start: string;
  working_hours_end: string;
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

export const fetchAvailability = async (
  date: string,
  productId?: number
): Promise<AvailabilityResponse> => {
  const params = new URLSearchParams({ date });
  if (productId) params.set('product_id', String(productId));
  const res = await fetch(`${API_BASE}/availability/?${params}`);
  if (!res.ok) throw new Error('Error al consultar disponibilidad');
  return res.json();
};

export const createAppointmentAdmin = async (
  token: string,
  payload: AppointmentPayload
): Promise<Appointment> => {
  const res = await fetch(`${API_BASE}/appointments/`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || 'Error al crear la cita');
  }
  return res.json();
};

export const createAppointment = async (
  payload: AppointmentPayload
): Promise<Appointment> => {
  const res = await fetch(`${API_BASE}/appointments/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err).map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(msg || 'Error al crear la cita');
  }
  return res.json();
};

export const fetchAppointments = async (token: string): Promise<CalendarEvent[]> => {
  const res = await fetch(`${API_BASE}/appointments/`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar citas');
  return res.json();
};

export const updateAppointment = async (
  token: string,
  id: number,
  data: Partial<AppointmentPayload & { status: string }>
): Promise<Appointment> => {
  const res = await fetch(`${API_BASE}/appointments/${id}/`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar la cita');
  return res.json();
};

export const deleteAppointment = async (token: string, id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/appointments/${id}/`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al eliminar la cita');
};

export const fetchCalendarSettings = async (token: string): Promise<CalendarSettings> => {
  const res = await fetch(`${API_BASE}/settings/`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar configuración');
  return res.json();
};

export const updateCalendarSettings = async (
  token: string,
  data: Partial<CalendarSettings>
): Promise<CalendarSettings> => {
  const res = await fetch(`${API_BASE}/settings/`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al guardar configuración');
  return res.json();
};
