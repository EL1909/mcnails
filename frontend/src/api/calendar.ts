const API_BASE = '/mcnails/api/calendars';

export interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

export interface AvailabilityResponse {
  date: string;
  slot_minutes: number;
  slots: TimeSlot[];
  closed?: boolean;
  timezone?: string;
}

export interface AppointmentPayload {
  /** Servicios de la cita. La duración del turno es la suma de todos. */
  products?: number[];
  /** Compatibilidad con el flujo de un solo servicio. */
  product?: number;
  /** Sin especificar, el backend asigna a quien tenga cupo libre. */
  team_member?: number;
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
  services: string[];
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
  team_member: number | null;
}

export interface AppointmentBillingOrder {
  id: number;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  is_fully_paid: boolean;
  has_receipt: boolean;
}

export interface AppointmentBilling {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  services: string[];
  start_time: string;
  end_time: string;
  status: string;
  order: AppointmentBillingOrder | null;
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
    team_member_id: number | null;
    team_member_name: string | null;
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
  productIds?: number[],
  teamMemberId?: number
): Promise<AvailabilityResponse> => {
  const params = new URLSearchParams({ date });
  (productIds ?? []).forEach((id) => params.append('product_id', String(id)));
  if (teamMemberId) params.append('team_member_id', String(teamMemberId));
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

export const fetchAppointments = async (token: string, teamMemberId?: number): Promise<CalendarEvent[]> => {
  const url = teamMemberId
    ? `${API_BASE}/appointments/?team_member_id=${teamMemberId}`
    : `${API_BASE}/appointments/`;
  const res = await fetch(url, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar citas');
  return res.json();
};

export const fetchAppointmentsBilling = async (
  token: string,
  start: string,
  end: string
): Promise<AppointmentBilling[]> => {
  const res = await fetch(`${API_BASE}/appointments/billing/?start=${start}&end=${end}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar las citas del mes');
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

export interface WeeklySchedule {
  id: number;
  team_member: number;
  weekday: number;
  weekday_label: string;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
}

export const fetchWeeklySchedule = async (token: string, teamMemberId: number): Promise<WeeklySchedule[]> => {
  const res = await fetch(`${API_BASE}/schedule/?team_member_id=${teamMemberId}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al cargar el horario');
  return res.json();
};

export const saveWeeklyScheduleDay = async (
  token: string,
  teamMemberId: number,
  existing: WeeklySchedule | undefined,
  data: { weekday: number; is_open: boolean; opens_at: string; closes_at: string }
): Promise<WeeklySchedule> => {
  const url = existing ? `${API_BASE}/schedule/${existing.id}/` : `${API_BASE}/schedule/`;
  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, team_member: teamMemberId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(Object.values(err).flat().join(' ') || 'Error al guardar el horario');
  }
  return res.json();
};

export interface TimeBlock {
  id: number;
  team_member: number | null;
  start: string;
  end: string;
  reason: string;
  reason_label: string;
  note: string;
  created_at: string;
}

export const fetchTimeBlocks = async (token: string, teamMemberId?: number): Promise<TimeBlock[]> => {
  const url = teamMemberId ? `${API_BASE}/blocks/?team_member_id=${teamMemberId}` : `${API_BASE}/blocks/`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error('Error al cargar los bloqueos');
  return res.json();
};

export const createTimeBlock = async (token: string, data: {
  team_member?: number | null;
  start: string;
  end: string;
  reason: string;
  note?: string;
}): Promise<TimeBlock> => {
  const res = await fetch(`${API_BASE}/blocks/`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(Object.values(err).flat().join(' ') || 'Error al crear el bloqueo');
  }
  return res.json();
};

export const deleteTimeBlock = async (token: string, id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/blocks/${id}/`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al eliminar el bloqueo');
};
