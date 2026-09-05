const API_BASE = '/mcnails/api/showcase';

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

// ── Proyectos (portafolio) ──────────────────────────────────────────────

export interface WebsiteProjectPhoto {
  id: number;
  project: number;
  image: string;
  caption: string;
  uploaded_at: string;
}

export interface WebsiteProject {
  id: number;
  title: string;
  subtitle: string;
  location: string;
  execution_time: string;
  kind: string;
  image: string | null;
  description: string;
  estimated_price: string | null;
  is_featured: boolean;
  visible_on_website: boolean;
  created_at: string;
  photos: WebsiteProjectPhoto[];
}

// Público: solo proyectos visibles.
export async function fetchPublicProjects(): Promise<WebsiteProject[]> {
  const res = await fetch(`${API_BASE}/projects/`);
  if (!res.ok) throw new Error('No se pudieron cargar los proyectos');
  return res.json();
}

// Admin: todos, visibles o no.
export async function fetchAllProjects(token: string): Promise<WebsiteProject[]> {
  const res = await fetch(`${API_BASE}/project-admin/`, { headers: authHeader(token) });
  if (!res.ok) throw new Error('No se pudieron cargar los proyectos');
  return res.json();
}

export interface ProjectInput {
  title: string;
  subtitle?: string;
  location?: string;
  execution_time?: string;
  kind?: string;
  description?: string;
  estimated_price?: string;
  is_featured?: boolean;
  visible_on_website?: boolean;
  image?: File;
}

export async function createProject(token: string, data: ProjectInput): Promise<WebsiteProject> {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) form.append(k, v instanceof File ? v : String(v));
  });
  const res = await fetch(`${API_BASE}/project-admin/`, {
    method: 'POST',
    headers: authHeader(token),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(Object.values(err).flat().join(' ') || 'Error al crear el proyecto');
  }
  return res.json();
}

export async function updateProject(
  token: string, id: number, data: Partial<ProjectInput>
): Promise<WebsiteProject> {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) form.append(k, v instanceof File ? v : String(v));
  });
  const res = await fetch(`${API_BASE}/project-admin/${id}/`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: form,
  });
  if (!res.ok) throw new Error('Error al actualizar el proyecto');
  return res.json();
}

export async function deleteProject(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/project-admin/${id}/`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al eliminar el proyecto');
}

export async function addProjectPhoto(token: string, projectId: number, image: File, caption?: string): Promise<WebsiteProjectPhoto> {
  const form = new FormData();
  form.append('project', String(projectId));
  form.append('image', image);
  if (caption) form.append('caption', caption);
  const res = await fetch(`${API_BASE}/project-photos/`, {
    method: 'POST',
    headers: authHeader(token),
    body: form,
  });
  if (!res.ok) throw new Error('Error al subir la foto');
  return res.json();
}

export async function deleteProjectPhoto(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/project-photos/${id}/`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al eliminar la foto');
}

// ── Reseñas ──────────────────────────────────────────────────────────────

export interface Review {
  id: number;
  author_name: string;
  author_location: string;
  rating: number;
  date: string;
  kind: string;
  comment: string;
  verified: boolean;
  avatar: string | null;
  project_photo: string | null;
  created_at: string;
}

// Público: solo reseñas ya verificadas.
export async function fetchPublicReviews(): Promise<Review[]> {
  const res = await fetch(`${API_BASE}/reviews/`);
  if (!res.ok) throw new Error('No se pudieron cargar las reseñas');
  return res.json();
}

export interface ReviewSubmission {
  author_name: string;
  author_location?: string;
  rating: number;
  date: string;
  comment: string;
}

// Envío público — nace sin verificar, pendiente de aprobación del panel.
export async function submitReview(data: ReviewSubmission): Promise<Review> {
  const res = await fetch(`${API_BASE}/reviews/submit/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(Object.values(err).flat().join(' ') || 'Error al enviar la reseña');
  }
  return res.json();
}

// Admin: todas, verificadas o pendientes.
export async function fetchAllReviews(token: string, verified?: boolean): Promise<Review[]> {
  const url = verified !== undefined
    ? `${API_BASE}/review-admin/?verified=${verified}`
    : `${API_BASE}/review-admin/`;
  const res = await fetch(url, { headers: authHeader(token) });
  if (!res.ok) throw new Error('No se pudieron cargar las reseñas');
  return res.json();
}

export async function setReviewVerified(token: string, id: number, verified: boolean): Promise<Review> {
  const res = await fetch(`${API_BASE}/review-admin/${id}/`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified }),
  });
  if (!res.ok) throw new Error('Error al actualizar la reseña');
  return res.json();
}

export async function deleteReview(token: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/review-admin/${id}/`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error('Error al eliminar la reseña');
}
