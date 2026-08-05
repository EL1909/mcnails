from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import reverse

from .models import (
    Appointment,
    AppointmentItem,
    CalendarSettings,
    TimeBlock,
    WeeklySchedule,
)


@admin.register(CalendarSettings)
class CalendarSettingsAdmin(admin.ModelAdmin):
    """Singleton: entra directo al formulario, sin lista ni añadir/borrar."""

    fieldsets = (
        ('Horario por defecto', {
            'fields': ('working_hours_start', 'working_hours_end'),
            'description': 'Se usa en los días que no tengan horario propio '
                           'en "Horario semanal".',
        }),
        ('Turnos', {'fields': ('buffer_minutes',)}),
        ('Google Calendar', {
            'fields': ('google_calendar_id',),
            'classes': ('collapse',),
        }),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        obj = CalendarSettings.load()
        return HttpResponseRedirect(
            reverse('admin:evz_calendars_calendarsettings_change', args=[obj.pk])
        )


@admin.register(WeeklySchedule)
class WeeklyScheduleAdmin(admin.ModelAdmin):
    list_display = ('weekday_label', 'is_open', 'opens_at', 'closes_at')
    list_editable = ('is_open', 'opens_at', 'closes_at')
    list_display_links = ('weekday_label',)
    ordering = ('weekday',)

    @admin.display(description='Día', ordering='weekday')
    def weekday_label(self, obj):
        return obj.get_weekday_display()


@admin.register(TimeBlock)
class TimeBlockAdmin(admin.ModelAdmin):
    list_display = ('start', 'end', 'reason', 'note')
    list_filter = ('reason',)
    date_hierarchy = 'start'


class AppointmentItemInline(admin.TabularInline):
    model = AppointmentItem
    extra = 1
    fields = ('product', 'description')


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'servicios', 'start_time', 'end_time',
                    'status', 'customer_phone')
    list_filter = ('status',)
    search_fields = ('customer_name', 'customer_email', 'customer_phone')
    date_hierarchy = 'start_time'
    ordering = ('-start_time',)
    inlines = [AppointmentItemInline]

    @admin.display(description='Servicios')
    def servicios(self, obj):
        return ', '.join(obj.service_names) or '—'
