#!/usr/bin/env bash
#
# Actualiza MCnails en esfuerzo1909-nginx-host-server: trae el código, migra
# la base de datos, reasigna a la dueña los registros que quedaron sin
# team_member, y reconstruye el frontend.
#
# nginx (sites-available/esfuerzovz) sirve frontend/dist directamente y
# hace proxy de /mcnails/api/ a 127.0.0.1:8002 (gunicorn-mcnails.service) —
# no necesita recargarse: solo lee los archivos que este script actualiza.

set -euo pipefail

APP_DIR="/home/efrain19091/projects/mcnails/mcnails"
VENV="/home/efrain19091/projects/mcnails/venv"
OWNER_EMAIL="marlyncabeza@gmail.com"

echo "==> Actualizando código"
cd "$APP_DIR"
git pull

echo "==> Backend: dependencias y migraciones"
cd "$APP_DIR/backend"
source "$VENV/bin/activate"
pip install -r requirements.txt

python manage.py migrate

# Un solo uso por deploy: reasigna a la dueña actual los registros que
# existían antes de que el equipo (TeamMember) fuera un concepto del
# sistema. Es idempotente — si ya se corrió, no hace nada de nuevo.
python manage.py backfill_team_member --email "$OWNER_EMAIL"

# Si el proyecto sirve estáticos vía Django (WhiteNoise, etc.) — omitir si
# los estáticos los sirve nginx directo desde otro lado.
# python manage.py collectstatic --noinput

echo "==> Frontend: dependencias y build"
cd "$APP_DIR/frontend"
npm install
npm run build

echo "==> Reiniciar gunicorn"
sudo systemctl restart gunicorn-mcnails.service

echo "==> Listo."
