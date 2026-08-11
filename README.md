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
├── backend/
│   ├── evz_core/       # [backbone] utilidades compartidas
│   ├── evz_store/      # [backbone] servicios (productos) y órdenes
│   ├── evz_treasury/   # [backbone] ingresos, gastos y abonos
│   ├── evz_billing/    # [backbone, opcional] cotizaciones y recibos
│   ├── evz_calendars/  # [backbone, opcional] citas, horarios y bloqueos
│   ├── accounts/       # propia del cliente: usuarios y autenticación
│   └── core/           # configuración del proyecto
└── frontend/           # React SPA
    └── src/
        ├── api/        # Clientes HTTP
        ├── components/
        └── context/
```

Las apps `evz_*` son el **backbone**: código pensado para reutilizarse en otras
empresas. `accounts` y `core` son propias de este cliente — cada empresa define
su propio modelo de usuario y su configuración.

Regla de dependencias: una app obligatoria (`evz_core`, `evz_store`) nunca
importa de una opcional (`evz_calendars`). Un cliente que no necesite agenda
simplemente no instala `evz_calendars`.

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/business/` | Identidad pública de la empresa (nombre, logo, contacto) |
| POST | `/api/accounts/register/` | Registro (email o WhatsApp) |
| POST | `/api/accounts/login/` | Login con email o teléfono |
| GET | `/api/accounts/users/` | Lista de clientes (admin) |
| PATCH | `/api/accounts/users/<id>/` | Editar cliente (admin) |
| POST | `/api/accounts/users/create/` | Crear cliente manual (admin) |
| GET | `/api/store/products/` | Catálogo de servicios |
| GET/POST | `/api/store/orders/` | Órdenes — crear es público; listar/editar, admin |
| PATCH | `/api/store/orders/<id>/` | Editar orden, ej. cerrarla (`status: completed`) |
| GET | `/api/store/orders/customers/` | Clientes únicos derivados de las órdenes (admin) |
| GET/POST | `/api/treasury/transactions/` | Ingresos y gastos (admin) |
| GET/POST | `/api/treasury/categories/` | Categorías de gasto (admin) |
| GET | `/api/treasury/summary/` | Ingresos, gastos y balance de un período (`?start=&end=`) |
| GET | `/api/treasury/summary/yearly/` | Desglose mes a mes de un año (`?year=`) |
| GET/POST | `/api/treasury/orders/<id>/payments/` | Abonos y saldo de una orden |
| GET | `/api/billing/fiscal/` | Reglas fiscales del país configurado |
| GET/POST | `/api/billing/quotations/` | Cotizaciones |
| POST | `/api/billing/quotations/<id>/accept/` | Aceptar → genera orden |
| GET | `/api/billing/receipts/` | Recibos emitidos |
| POST | `/api/billing/receipts/issue/` | Emitir recibo |
| POST | `/api/billing/receipts/<id>/void/` | Anular recibo |
| GET | `/api/calendars/availability/` | Turnos libres (acepta varios `product_id`) |
| GET/POST | `/api/calendars/schedule/` | Horario por día de la semana |
| GET/POST | `/api/calendars/blocks/` | Bloqueos: vacaciones, feriados |
| GET/POST | `/api/calendars/appointments/` | Citas — al crear con servicios, genera su Order automáticamente |
| PATCH/DELETE | `/api/calendars/appointments/<id>/` | Gestionar cita (admin) |
| GET | `/api/calendars/appointments/billing/` | Citas de un rango con su estado de pago (`?start=&end=`, admin) |

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

Variables opcionales (tienen default, se listan por si hay que cambiarlas):
```
ALLOWED_HOSTS=localhost,127.0.0.1,esfuerzovz.com,www.esfuerzovz.com
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://esfuerzovz.com
URL_PREFIX=mcnails/
FORCE_SCRIPT_NAME=

# Zona horaria del negocio: las citas se muestran en la hora del local
TIME_ZONE=America/Caracas

# Integración con EsfuerzoVZ (el token lo emite EsfuerzoVZ)
EVZ_API_URL=https://esfuerzovz.com
EVZ_API_TOKEN=
```

> `URL_PREFIX` y `FORCE_SCRIPT_NAME` son **alternativas, no se usan juntas**.
> Con ambas puestas, `reverse()` genera `/mcnails/mcnails/...` y se rompen los
> enlaces de email y los redirects del admin.

**Al mudarse a dominio propio** (ej. `mcnails.com`) basta con cambiar el `.env`,
sin tocar código:
```
ALLOWED_HOSTS=mcnails.com,www.mcnails.com
CORS_ALLOWED_ORIGINS=https://mcnails.com
URL_PREFIX=
FORCE_SCRIPT_NAME=
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
