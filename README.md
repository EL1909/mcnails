# MCnails

Plataforma de reservas y gestión para salón de uñas. Integrada como subdominio de [EsfuerzoVZ](https://www.esfuerzovz.com/mcnails).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Django 6, Django REST Framework |
| Base de datos | PostgreSQL |
| Autenticación | JWT (SimpleJWT) |
| Calendario | FullCalendar v6 |

## Estructura

```
MCnails/
├── backend/          # Django REST API
│   ├── accounts/     # Usuarios y autenticación
│   ├── calendars/    # Citas y disponibilidad
│   ├── store/        # Servicios (productos) y órdenes
│   └── core/         # Configuración del proyecto
└── frontend/         # React SPA
    └── src/
        ├── api/      # Clientes HTTP
        ├── components/
        └── context/
```

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/accounts/register/` | Registro (email o WhatsApp) |
| POST | `/api/accounts/login/` | Login con email o teléfono |
| GET | `/api/accounts/users/` | Lista de clientes (admin) |
| PATCH | `/api/accounts/users/<id>/` | Editar cliente (admin) |
| POST | `/api/accounts/users/create/` | Crear cliente manual (admin) |
| GET | `/api/store/products/` | Catálogo de servicios |
| GET | `/api/calendars/availability/` | Horarios disponibles |
| GET/POST | `/api/calendars/appointments/` | Citas |
| PATCH/DELETE | `/api/calendars/appointments/<id>/` | Gestionar cita (admin) |

## Setup — Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Crear `backend/.env`:
```
SECRET_KEY=tu-secret-key-aqui
DEBUG=True
DATABASE_URL=postgres://usuario@localhost/mcnails
```

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

## Setup — Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend corre en `http://localhost:3000`.
