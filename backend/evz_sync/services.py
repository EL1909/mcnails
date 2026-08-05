"""Publicación de un período hacia EsfuerzoVZ."""

import calendar
import datetime

from . import client
from .collector import build_report
from .models import SyncLog


def month_range(year, month):
    ultimo = calendar.monthrange(year, month)[1]
    return datetime.date(year, month, 1), datetime.date(year, month, ultimo)


def previous_month():
    hoy = datetime.date.today()
    primero = hoy.replace(day=1)
    anterior = primero - datetime.timedelta(days=1)
    return month_range(anterior.year, anterior.month)


def publish_period(start, end):
    """
    Arma el reporte del período y lo envía.

    Registra el resultado siempre, haya salido bien o mal: un envío fallido
    que no deja rastro es peor que uno que falla ruidosamente.
    """
    if start > end:
        raise ValueError("El inicio del período es posterior al fin.")

    reporte = build_report(start, end)

    try:
        http_status, respuesta = client.publish(reporte)
    except client.SyncNotConfigured:
        # No se registra: no llegó a intentarse, es un problema de configuración.
        raise
    except client.SyncFailed as e:
        SyncLog.objects.create(
            period_start=start, period_end=end,
            status=SyncLog.Status.FAILED,
            http_status=e.http_status, error=str(e),
            payload=reporte, response=e.response,
        )
        raise

    return SyncLog.objects.create(
        period_start=start, period_end=end,
        status=SyncLog.Status.OK,
        http_status=http_status,
        payload=reporte, response=respuesta,
    )


def remote_status():
    """
    Estado según EsfuerzoVZ, o el motivo por el que no se pudo consultar.

    Nunca lanza: se usa para pintar pantallas, y que EsfuerzoVZ esté caído no
    debe romper el admin de la empresa.
    """
    try:
        _, datos = client.fetch_status()
        return {'available': True, **datos}
    except client.SyncNotConfigured as e:
        return {'available': False, 'reason': 'not_configured', 'detail': str(e)}
    except client.SyncFailed as e:
        return {'available': False, 'reason': 'unreachable', 'detail': str(e)}
