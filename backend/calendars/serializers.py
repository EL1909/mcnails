from rest_framework import serializers
from .models import Appointment, CalendarSettings


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = [
            'id', 'order', 'product', 'customer_name', 'customer_email',
            'customer_phone', 'start_time', 'end_time', 'status', 'notes',
            'google_event_id', 'created_at',
        ]
        read_only_fields = ['id', 'google_event_id', 'created_at']


class CalendarSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarSettings
        fields = ['id', 'google_calendar_id', 'buffer_minutes', 'working_hours_start', 'working_hours_end']
