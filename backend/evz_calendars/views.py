from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from evz_core.models import TeamMember
from evz_store.models import Product

from . import notifications
from .availability import (
    available_slots,
    available_slots_any,
    find_available_team_member,
    is_slot_free,
)
from .models import Appointment, CalendarSettings, TimeBlock, WeeklySchedule
from .serializers import (
    AppointmentSerializer,
    CalendarSettingsSerializer,
    TimeBlockSerializer,
    WeeklyScheduleSerializer,
)


def team_member_of(user):
    """
    TeamMember vinculado a este usuario, o None.

    No se usa getattr(user, 'team_member', None): el reverse de un
    OneToOneField lanza TeamMember.DoesNotExist (no AttributeError) cuando no
    existe, así que getattr con default no lo atrapa.
    """
    return TeamMember.objects.filter(user=user).first()


class AvailabilityView(APIView):
    """
    GET /api/calendars/availability/?date=YYYY-MM-DD&product_id=1&product_id=2&team_member_id=3

    Acepta varios product_id: la duración del turno es la suma de los
    servicios pedidos. Las horas van en la zona del negocio.

    Sin `team_member_id`: disponibilidad combinada de todo el equipo activo
    ("cualquiera disponible") — un turno aparece si al menos una persona está
    libre ahí.
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

        team_member_id = request.query_params.get('team_member_id')
        if team_member_id:
            team_member = TeamMember.objects.filter(pk=team_member_id, is_active=True).first()
            if not team_member:
                return Response({'error': 'Miembro del equipo inválido.'},
                                status=status.HTTP_404_NOT_FOUND)
            return Response(available_slots(date, team_member, productos))

        return Response(available_slots_any(date, productos))


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

        # Dueña (superuser): ve a todo el equipo, o a quien filtre con
        # ?team_member_id=. Cada team_member (staff, no superuser): solo su
        # propia agenda — sin excepción, aunque adivine el id de otra cita.
        citas_qs = Appointment.objects.select_related('team_member').prefetch_related('items__product')
        bloqueos_qs = TimeBlock.objects.all()
        if request.user.is_superuser:
            team_member_id = request.query_params.get('team_member_id')
            if team_member_id:
                citas_qs = citas_qs.filter(team_member_id=team_member_id)
                bloqueos_qs = bloqueos_qs.filter(Q(team_member_id=team_member_id) | Q(team_member__isnull=True))
        else:
            tm = team_member_of(request.user)
            citas_qs = citas_qs.filter(team_member=tm) if tm else citas_qs.none()
            bloqueos_qs = bloqueos_qs.filter(Q(team_member=tm) | Q(team_member__isnull=True)) if tm \
                else bloqueos_qs.filter(team_member__isnull=True)

        eventos = []
        for appt in citas_qs:
            servicios = appt.service_names
            titulo = appt.customer_name
            if servicios:
                titulo += f" — {', '.join(servicios)}"

            # Convertir a datetime consciente de zona horaria (naive a aware)
            from django.utils import timezone
            from django.conf import settings
            tz = timezone.get_current_timezone()
            start = timezone.make_aware(appt.start_time, tz) if appt.start_time.tzinfo is None else appt.start_time
            end = timezone.make_aware(appt.end_time, tz) if appt.end_time.tzinfo is None else appt.end_time

            eventos.append({
                'id': appt.id,
                'title': titulo,
                'start': start.isoformat(),
                'end': end.isoformat(),
                'color': colores.get(appt.status, '#78716c'),
                'extendedProps': {
                    'customer_email': appt.customer_email,
                    'customer_phone': appt.customer_phone,
                    'status': appt.status,
                    'notes': appt.notes,
                    'order_id': appt.order_id,
                    'services': servicios,
                    'team_member_id': appt.team_member_id,
                    'team_member_name': appt.team_member.display_name if appt.team_member_id else None,
                },
            })

        # Los bloqueos se dibujan como eventos de fondo para que la dueña vea
        # sus vacaciones en el mismo calendario que sus citas.
        for b in bloqueos_qs:
            from django.utils import timezone
            tz = timezone.get_current_timezone()
            start = timezone.make_aware(b.start, tz) if b.start.tzinfo is None else b.start
            end = timezone.make_aware(b.end, tz) if b.end.tzinfo is None else b.end

            eventos.append({
                'id': f'block-{b.id}',
                'title': b.note or b.get_reason_display(),
                'start': start.isoformat(),
                'end': end.isoformat(),
                'display': 'background',
                'color': '#e7e5e4',
            })

        return Response(eventos)

    def post(self, request):
        serializer = AppointmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        start = serializer.validated_data['start_time']
        end = serializer.validated_data['end_time']
        team_member = serializer.validated_data.get('team_member')

        # Sin team_member: "cualquiera disponible" — se asigna a quien tenga
        # cupo libre. Con team_member: se revalida contra su agenda, porque
        # la disponibilidad que vio el navegador pudo quedar obsoleta entre
        # que cargó la página y envió el formulario.
        if team_member is None:
            team_member = find_available_team_member(start, end)
            if team_member is None:
                return Response(
                    {'error': 'No hay nadie del equipo disponible en ese horario.'},
                    status=status.HTTP_409_CONFLICT,
                )
        else:
            libre, motivo = is_slot_free(start, end, team_member)
            if not libre:
                return Response({'error': motivo}, status=status.HTTP_409_CONFLICT)

        appt = serializer.save(team_member=team_member)
        notifications.send_booking_confirmation(appt)
        return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)


class AppointmentBillingListView(APIView):
    """
    GET /api/calendars/appointments/billing/?start=&end= — citas de un
    rango con su estado de pago, para el desglose de "Ingresos" del panel
    de Facturación.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        import datetime

        from django.utils import timezone

        from evz_billing.models import Receipt
        from evz_treasury import services as treasury_services

        start = parse_date(request.query_params.get('start', ''))
        end = parse_date(request.query_params.get('end', ''))
        if not start or not end:
            return Response({'error': 'Se requieren start y end (YYYY-MM-DD)'},
                            status=status.HTTP_400_BAD_REQUEST)

        tz = timezone.get_current_timezone()
        rango_inicio = timezone.make_aware(datetime.datetime.combine(start, datetime.time.min), tz)
        rango_fin = timezone.make_aware(datetime.datetime.combine(end, datetime.time.max), tz)

        citas = (
            Appointment.objects
            .filter(start_time__gte=rango_inicio, start_time__lte=rango_fin)
            .select_related('order')
            .prefetch_related('items__product')
            .order_by('start_time')
        )

        resultado = []
        for appt in citas:
            order_data = None
            if appt.order_id:
                order = appt.order
                order_data = {
                    'id': order.id,
                    'total_amount': str(order.total_amount),
                    'amount_paid': str(treasury_services.amount_paid(order)),
                    'balance_due': str(treasury_services.balance_due(order)),
                    'is_fully_paid': treasury_services.is_fully_paid(order),
                    'has_receipt': Receipt.objects.filter(
                        order=order, voided_at__isnull=True
                    ).exists(),
                }
            resultado.append({
                'id': appt.id,
                'customer_name': appt.customer_name,
                'customer_email': appt.customer_email,
                'customer_phone': appt.customer_phone,
                'services': appt.service_names,
                'start_time': appt.start_time.isoformat(),
                'end_time': appt.end_time.isoformat(),
                'status': appt.status,
                'order': order_data,
            })

        return Response(resultado)


class AppointmentDetailView(APIView):
    """PATCH/DELETE /api/calendars/appointments/<id>/ — admin"""
    permission_classes = [IsAdminUser]

    def get_object(self, pk, request):
        appt = Appointment.objects.filter(pk=pk).first()
        if not appt:
            return None
        # Una team_member solo toca lo suyo — devolver None (404) en vez de
        # 403 para no revelar que la cita de otra persona existe.
        if not request.user.is_superuser:
            tm = team_member_of(request.user)
            if appt.team_member_id != getattr(tm, 'id', None):
                return None
        return appt

    def patch(self, request, pk):
        appt = self.get_object(pk, request)
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
        appt = self.get_object(pk, request)
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


class TeamScopedViewSet(viewsets.ModelViewSet):
    """
    Base para ViewSets que se reparten por team_member: dueña (superuser) ve
    y gestiona todo (filtrable con ?team_member_id=); cada team_member solo
    lo suyo.

    El team_member se inyecta en los datos ANTES de validar (no después vía
    perform_create/update): el validador automático de unique_together de
    DRF fuerza a `required=True` cualquier campo que participe en él, sin
    importar el `required=False` declarado en el serializer — si se
    inyectara después, una team_member no podría crear/editar el suyo sin
    mandarlo ella misma en el payload.
    """

    def _scoped_data(self, request):
        if request.user.is_superuser:
            return request.data
        data = request.data.copy()
        tm = team_member_of(request.user)
        data['team_member'] = tm.id if tm else None
        return data

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=self._scoped_data(request))
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=self._scoped_data(request), partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)


class WeeklyScheduleViewSet(TeamScopedViewSet):
    """
    Horario de atención por día de la semana, por miembro del equipo.

    Dueña (superuser): ve/gestiona el de todos, filtrable con
    ?team_member_id=. Cada team_member: solo el suyo — no puede ver, editar
    ni crear el de otra persona, aunque lo intente por payload.
    """
    serializer_class = WeeklyScheduleSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = WeeklySchedule.objects.select_related('team_member')
        if self.request.user.is_superuser:
            team_member_id = self.request.query_params.get('team_member_id')
            return qs.filter(team_member_id=team_member_id) if team_member_id else qs
        tm = team_member_of(self.request.user)
        return qs.filter(team_member=tm) if tm else qs.none()


class TimeBlockViewSet(TeamScopedViewSet):
    """
    Vacaciones, feriados y ausencias.

    Dueña (superuser): ve/gestiona todos los bloqueos, filtrable con
    ?team_member_id=. Cada team_member: ve los suyos + los de todo el
    negocio (team_member nulo, ej. feriados) para no reservarse encima, pero
    solo puede crear/editar/borrar los propios — nunca los del negocio.
    """
    serializer_class = TimeBlockSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = TimeBlock.objects.select_related('team_member')
        if self.request.user.is_superuser:
            team_member_id = self.request.query_params.get('team_member_id')
            if team_member_id:
                return qs.filter(Q(team_member_id=team_member_id) | Q(team_member__isnull=True))
            return qs

        tm = team_member_of(self.request.user)
        if self.action in ('list', 'retrieve'):
            return qs.filter(Q(team_member=tm) | Q(team_member__isnull=True)) if tm \
                else qs.filter(team_member__isnull=True)
        # update/partial_update/destroy: nunca los de todo el negocio.
        return qs.filter(team_member=tm) if tm else qs.none()
