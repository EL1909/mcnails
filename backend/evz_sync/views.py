from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import client, services
from .collector import preview
from .models import SyncLog


def _period(request, data=None):
    origen = data if data is not None else request.query_params
    inicio = parse_date(str(origen.get('period_start', '')))
    fin = parse_date(str(origen.get('period_end', '')))
    if not inicio or not fin:
        inicio, fin = services.previous_month()
    return inicio, fin


class SyncStatusView(APIView):
    """
    GET /api/sync/status/

    Estado de la conexión con EsfuerzoVZ, solicitudes pendientes y las últimas
    publicaciones. Alimenta la pantalla desde donde se publica.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        inicio, fin = _period(request)
        recientes = SyncLog.objects.all()[:10]
        return Response({
            'remote': services.remote_status(),
            'suggested_period': {'start': inicio, 'end': fin},
            'history': [
                {
                    'period_start': l.period_start,
                    'period_end': l.period_end,
                    'status': l.status,
                    'http_status': l.http_status,
                    'error': l.error,
                    'sent_at': l.sent_at,
                    'totals': (l.payload or {}).get('totals'),
                }
                for l in recientes
            ],
        })


class SyncPreviewView(APIView):
    """
    GET /api/sync/preview/?period_start=&period_end=

    Lo que se enviaría, sin enviarlo. Publicar a ciegas sobre datos
    financieros es mala idea.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        inicio, fin = _period(request)
        if inicio > fin:
            return Response({'error': 'El inicio es posterior al fin.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(preview(inicio, fin))


class SyncPublishView(APIView):
    """
    POST /api/sync/publish/

    Publica el período en EsfuerzoVZ. Siempre lo dispara la empresa.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        inicio, fin = _period(request, request.data)
        try:
            log = services.publish_period(inicio, fin)
        except client.SyncNotConfigured as e:
            return Response({'error': str(e), 'reason': 'not_configured'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except client.SyncFailed as e:
            return Response(
                {'error': str(e), 'http_status': e.http_status,
                 'reason': 'rejected'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': 'publicado',
            'period': {'start': log.period_start, 'end': log.period_end},
            'response': log.response,
        }, status=status.HTTP_201_CREATED)
