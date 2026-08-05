"""
Cliente HTTP hacia EsfuerzoVZ.

La publicación siempre la dispara la dueña; este módulo no decide cuándo.
"""

import json
import logging
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT = 20


class SyncNotConfigured(Exception):
    """Falta el token o la URL de EsfuerzoVZ."""


class SyncFailed(Exception):
    """EsfuerzoVZ rechazó el envío o no se pudo llegar."""

    def __init__(self, message, http_status=None, response=None):
        super().__init__(message)
        self.http_status = http_status
        self.response = response or {}


def _check_config():
    url = (getattr(settings, 'EVZ_API_URL', '') or '').rstrip('/')
    token = getattr(settings, 'EVZ_API_TOKEN', '') or ''
    if not url or not token:
        raise SyncNotConfigured(
            "Falta EVZ_API_URL o EVZ_API_TOKEN en el .env. El token lo emite "
            "EsfuerzoVZ."
        )
    return url, token


def _request(method, path, body=None):
    url, token = _check_config()
    datos = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f'{url}/api/integrations/{path}',
        data=datos,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, json.loads(resp.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        cuerpo = {}
        try:
            cuerpo = json.loads(e.read().decode() or '{}')
        except Exception:
            pass
        # El mensaje de EsfuerzoVZ es más útil que el código HTTP: dice si el
        # período se solapa, si el token está revocado, etc.
        raise SyncFailed(
            cuerpo.get('error') or f'EsfuerzoVZ respondió {e.code}',
            http_status=e.code, response=cuerpo,
        )
    except urllib.error.URLError as e:
        raise SyncFailed(f'No se pudo conectar con EsfuerzoVZ: {e.reason}')
    except (TimeoutError, OSError) as e:
        raise SyncFailed(f'Error de red al contactar EsfuerzoVZ: {e}')


def publish(report):
    """Envía el reporte. Devuelve (http_status, respuesta)."""
    return _request('POST', 'sync/', report)


def fetch_status():
    """
    Estado del vínculo según EsfuerzoVZ: última publicación y si hay una
    solicitud pendiente de actualización.
    """
    return _request('GET', 'sync/')
