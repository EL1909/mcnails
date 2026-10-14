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
# --upgrade: sin esto, pip puede considerar "evz-backbone" ya satisfecho y
# NO reinstalar la versión nueva aunque el tag en requirements.txt cambió —
# dejaría la VM corriendo código viejo pese al git pull.
pip install --upgrade -r requirements.txt

# Aun con --upgrade, pip a veces da por satisfecha una dependencia instalada
# desde git y no la reemplaza. Se compara la versión instalada con el tag de
# requirements.txt y, si no coinciden, se fuerza la reinstalación.
EVZ_REQ=$(grep -E '^evz-backbone(\[[^]]*\])? @' requirements.txt | tr -d '\r' | sed 's/[[:space:]]*$//')
EVZ_TAG=$(sed -E 's/.*@v?([0-9][0-9.]*)$/\1/' <<<"$EVZ_REQ")
evz_instalada() { python -c 'from importlib.metadata import version; print(version("evz-backbone"))'; }
if [ "$(evz_instalada)" != "$EVZ_TAG" ]; then
  echo "==> evz-backbone instalado $(evz_instalada), se esperaba $EVZ_TAG: reinstalando"
  pip install --force-reinstall --no-deps "$EVZ_REQ"
fi
if [ "$(evz_instalada)" != "$EVZ_TAG" ]; then
  echo "ERROR: evz-backbone quedó en $(evz_instalada), se esperaba $EVZ_TAG." >&2
  exit 1
fi
echo "==> evz-backbone $EVZ_TAG"

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
