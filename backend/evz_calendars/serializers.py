from rest_framework import serializers

from evz_store.models import Product

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

    class Meta:
        model = Appointment
        fields = [
            'id', 'order', 'products', 'product', 'items', 'services',
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
        return appt

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

    class Meta:
        model = WeeklySchedule
        fields = ('id', 'weekday', 'weekday_label', 'is_open', 'opens_at', 'closes_at')

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

    class Meta:
        model = TimeBlock
        fields = ('id', 'start', 'end', 'reason', 'reason_label', 'note', 'created_at')
        read_only_fields = ('created_at',)

    def validate(self, attrs):
        inicio = attrs.get('start', getattr(self.instance, 'start', None))
        fin = attrs.get('end', getattr(self.instance, 'end', None))
        if inicio and fin and inicio >= fin:
            raise serializers.ValidationError(
                {'end': "El fin debe ser posterior al inicio."}
            )
        return attrs
