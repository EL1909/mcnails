from django.contrib import admin
from .models import Appointment, CalendarSettings


@admin.register(CalendarSettings)
class CalendarSettingsAdmin(admin.ModelAdmin):
    list_display = ('google_calendar_id', 'buffer_minutes', 'working_hours_start', 'working_hours_end')


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'customer_email', 'product', 'start_time', 'end_time', 'status', 'created_at')
    list_filter = ('status',)
    ordering = ('-start_time',)
