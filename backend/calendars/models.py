from django.db import models
from store.models import Order, Product


class CalendarSettings(models.Model):
    """Singleton-style settings for Google Calendar integration."""
    google_calendar_id = models.CharField(
        max_length=255, blank=True,
        help_text="Google Calendar ID shared with the service account"
    )
    buffer_minutes = models.IntegerField(
        default=0,
        help_text="Buffer time in minutes between appointments"
    )
    working_hours_start = models.TimeField(default='09:00')
    working_hours_end = models.TimeField(default='19:00')

    class Meta:
        verbose_name = "Calendar Settings"
        verbose_name_plural = "Calendar Settings"

    def __str__(self):
        return "Calendar Settings"


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('confirmed', 'Confirmado'),
        ('completed', 'Completado'),
        ('cancelled', 'Cancelado'),
    ]

    order = models.OneToOneField(
        Order, on_delete=models.CASCADE,
        related_name='appointment', null=True, blank=True
    )
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True
    )
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True)
    customer_phone = models.CharField(max_length=50, blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    google_event_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f"{self.customer_name} — {self.start_time.strftime('%Y-%m-%d %H:%M')}"
