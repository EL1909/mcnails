from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from evz_store.models import Product

from . import notifications
from .availability import available_slots, is_slot_free
from .models import Appointment, CalendarSettings, TimeBlock, WeeklySchedule
from .serializers import (
    AppointmentSerializer,
    CalendarSettingsSerializer,
    TimeBlockSerializer,
    WeeklyScheduleSerializer,
)


class AvailabilityView(APIView):
    """
    GET /api/calendars/availability/?date=YYYY-MM-DD&product_id=1&product_id=2

    Acepta varios product_id: la duración del turno es la suma de los
    servicios pedidos. Las horas van en la zona del negocio.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'Se requiere date'},
                            status=status.HTTP_400_BAD_REQUEST)

        date = parse_date(date_str)
        if not date:
            return Response({'error': 'Formato inválido. Use YYYY-MM-DD'},
                            status=status.HTTP_400_BAD_REQUEST)

        ids = request.query_params.getlist('product_id')
        productos = list(Product.objects.filter(id__in=ids, is_active=True)) if ids else []
        return Response(available_slots(date, productos))


class AppointmentListCreateView(APIView):
    """
    GET  /api/calendars/appointments/ — admin, en formato FullCalendar
    POST                              — público, desde el flujo de reserva
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAdminUser()]
        return [AllowAny()]

    def get(self, request):
        colores = {
            'pending': '#78716c',
            'confirmed': '#16a34a',
            'completed': '#44403c',
            'cancelled': '#dc2626',
        }
        eventos = []
        for appt in Appointment.objects.prefetch_related('items__product'):
            servicios = appt.service_names
            titulo = appt.customer_name
            if servicios:
                titulo += f" — {', '.join(servicios)}"
            eventos.append({
                'id': appt.id,
                'title': titulo,
                'start': appt.start_time.isoformat(),
                'end': appt.end_time.isoformat(),
                'color': colores.get(appt.status, '#78716c'),
                'extendedProps': {
                    'customer_email': appt.customer_email,
                    'customer_phone': appt.customer_phone,
                    'status': appt.status,
                    'notes': appt.notes,
                    'order_id': appt.order_id,
                    'services': servicios,
                },
            })

        # Los bloqueos se dibujan como eventos de fondo para que la dueña vea
        # sus vacaciones en el mismo calendario que sus citas.
        for b in TimeBlock.objects.all():
            eventos.append({
                'id': f'block-{b.id}',
                'title': b.note or b.get_reason_display(),
                'start': b.start.isoformat(),
                'end': b.end.isoformat(),
                'display': 'background',
                'color': '#e7e5e4',
            })

        return Response(eventos)

    def post(self, request):
        serializer = AppointmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Revalidar contra la agenda: la disponibilidad que vio el navegador
        # pudo quedar obsoleta entre que cargó la página y envió el formulario.
        libre, motivo = is_slot_free(
            serializer.validated_data['start_time'],
            serializer.validated_data['end_time'],
        )
        if not libre:
            return Response({'error': motivo}, status=status.HTTP_409_CONFLICT)

        appt = serializer.save()
        notifications.send_booking_confirmation(appt)
        return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)


class AppointmentDetailView(APIView):
    """PATCH/DELETE /api/calendars/appointments/<id>/ — admin"""
    permission_classes = [IsAdminUser]

    def get_object(self, pk):
        return Appointment.objects.filter(pk=pk).first()

    def patch(self, request, pk):
        appt = self.get_object(pk)
        if not appt:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)

        estado_previo = appt.status
        serializer = AppointmentSerializer(appt, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        appt = serializer.save()

        if estado_previo != 'cancelled' and appt.status == 'cancelled':
            notifications.send_cancellation(appt)
        return Response(AppointmentSerializer(appt).data)

    def delete(self, request, pk):
        appt = self.get_object(pk)
        if not appt:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)
        notifications.send_cancellation(appt)
        appt.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CalendarSettingsView(APIView):
    """GET/PATCH /api/calendars/settings/ — admin"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(CalendarSettingsSerializer(CalendarSettings.load()).data)

    def patch(self, request):
        cfg = CalendarSettings.load()
        serializer = CalendarSettingsSerializer(cfg, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)


class WeeklyScheduleViewSet(viewsets.ModelViewSet):
    """Horario de atención por día de la semana."""
    queryset = WeeklySchedule.objects.all()
    serializer_class = WeeklyScheduleSerializer
    permission_classes = [IsAdminUser]


class TimeBlockViewSet(viewsets.ModelViewSet):
    """Vacaciones, feriados y ausencias."""
    queryset = TimeBlock.objects.all()
    serializer_class = TimeBlockSerializer
    permission_classes = [IsAdminUser]
