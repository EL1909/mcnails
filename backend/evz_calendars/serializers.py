import zoneinfo

from django.conf import settings
from rest_framework import serializers

from evz_core.models import TeamMember
from evz_store.models import Order, OrderItem, Product

from .models import (
    Appointment,
    AppointmentItem,
    CalendarSettings,
    TimeBlock,
    WeeklySchedule,
)


class AppointmentItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentItem
        fields = ('id', 'product', 'description')


class AppointmentSerializer(serializers.ModelSerializer):
    items = AppointmentItemSerializer(many=True, read_only=True)
    services = serializers.ListField(read_only=True, source='service_names')

    # Entrada: lista de ids de servicio.
    products = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False,
        queryset=Product.objects.filter(is_active=True),
    )
    # Compatibilidad con el flujo viejo, que mandaba un solo `product`.
    product = serializers.PrimaryKeyRelatedField(
        write_only=True, required=False, allow_null=True,
        queryset=Product.objects.filter(is_active=True),
    )
    # Opcional: si no viene, la vista asigna automáticamente a quien tenga
    # cupo libre ("cualquiera disponible").
    team_member = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True,
        queryset=TeamMember.objects.filter(is_active=True),
    )

    class Meta:
        model = Appointment
        fields = [
            'id', 'order', 'team_member', 'products', 'product', 'items', 'services',
            'customer_name', 'customer_email', 'customer_phone',
            'start_time', 'end_time', 'status', 'notes',
            'google_event_id', 'created_at',
        ]
        read_only_fields = ['id', 'google_event_id', 'created_at']

    def validate(self, attrs):
        inicio = attrs.get('start_time', getattr(self.instance, 'start_time', None))
        fin = attrs.get('end_time', getattr(self.instance, 'end_time', None))
        if inicio and fin and inicio >= fin:
            raise serializers.ValidationError(
                {'end_time': "El fin debe ser posterior al inicio."}
            )
        return attrs

    def _servicios(self, validated):
        productos = validated.pop('products', [])
        uno = validated.pop('product', None)
        if uno and uno not in productos:
            productos = list(productos) + [uno]
        return productos

    def create(self, validated_data):
        productos = self._servicios(validated_data)
        appt = super().create(validated_data)
        for p in productos:
            AppointmentItem.objects.create(appointment=appt, product=p)

        # Toda cita con servicios necesita una Order para poder cobrarse y
        # facturarse (tesorería y recibos trabajan sobre Order, no sobre
        # Appointment). Se crea acá, en un único lugar, para que tanto el
        # flujo público como el del panel admin queden cubiertos sin
        # duplicar esta lógica en el frontend.
        if appt.order_id is None and productos:
            self._crear_order(appt, productos)

        return appt

    def _crear_order(self, appt, productos):
        tz = zoneinfo.ZoneInfo(settings.TIME_ZONE)
        local_start = appt.start_time.astimezone(tz)
        order = Order.objects.create(
            customer_name=appt.customer_name,
            customer_email=appt.customer_email,
            customer_phone=appt.customer_phone,
            booking_date=local_start.date(),
            booking_time=local_start.time(),
            team_member=appt.team_member,
        )
        for p in productos:
            OrderItem.objects.create(
                order=order, product=p, quantity=1, price_at_purchase=p.price,
            )
        appt.order = order
        appt.save(update_fields=['order'])

    def update(self, instance, validated_data):
        productos = self._servicios(validated_data)
        appt = super().update(instance, validated_data)
        if productos:
            appt.items.all().delete()
            for p in productos:
                AppointmentItem.objects.create(appointment=appt, product=p)
        return appt


class CalendarSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarSettings
        fields = ['id', 'google_calendar_id', 'buffer_minutes',
                  'working_hours_start', 'working_hours_end']


class WeeklyScheduleSerializer(serializers.ModelSerializer):
    weekday_label = serializers.CharField(source='get_weekday_display', read_only=True)
    # Opcional: la vista la fuerza a la propia cuenta si no es superuser.
    team_member = serializers.PrimaryKeyRelatedField(
        required=False, queryset=TeamMember.objects.all(),
    )

    class Meta:
        model = WeeklySchedule
        fields = ('id', 'team_member', 'weekday', 'weekday_label', 'is_open', 'opens_at', 'closes_at')

    def validate(self, attrs):
        abre = attrs.get('opens_at', getattr(self.instance, 'opens_at', None))
        cierra = attrs.get('closes_at', getattr(self.instance, 'closes_at', None))
        abierto = attrs.get('is_open', getattr(self.instance, 'is_open', True))
        if abierto and abre and cierra and abre >= cierra:
            raise serializers.ValidationError(
                {'closes_at': "El cierre debe ser posterior a la apertura."}
            )
        return attrs


class TimeBlockSerializer(serializers.ModelSerializer):
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    # Opcional: vacío = bloqueo de todo el negocio. La vista fuerza la propia
    # cuenta si no es superuser (una team_member no puede crear uno global).
    team_member = serializers.PrimaryKeyRelatedField(
        required=False, allow_null=True, queryset=TeamMember.objects.all(),
    )

    class Meta:
        model = TimeBlock
        fields = ('id', 'team_member', 'start', 'end', 'reason', 'reason_label', 'note', 'created_at')
        read_only_fields = ('created_at',)

    def validate(self, attrs):
        inicio = attrs.get('start', getattr(self.instance, 'start', None))
        fin = attrs.get('end', getattr(self.instance, 'end', None))
        if inicio and fin and inicio >= fin:
            raise serializers.ValidationError(
                {'end': "El fin debe ser posterior al inicio."}
            )
        return attrs
