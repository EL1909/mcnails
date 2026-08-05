from datetime import time

from django.db import models

from evz_store.models import Order, Product


class SingletonQuerySet(models.QuerySet):
    def delete(self):
        return 0, {}


class CalendarSettings(models.Model):
    """Configuración de la agenda. Una sola fila por deploy."""

    google_calendar_id = models.CharField(
        max_length=255, blank=True,
        help_text="ID del Google Calendar compartido con la cuenta de servicio"
    )
    buffer_minutes = models.IntegerField(
        default=0,
        help_text="Minutos de holgura entre citas"
    )
    # Horario por defecto, usado para los días sin WeeklySchedule propio.
    working_hours_start = models.TimeField(default=time(9, 0))
    working_hours_end = models.TimeField(default=time(19, 0))

    objects = SingletonQuerySet.as_manager()

    class Meta:
        verbose_name = "Configuración de agenda"
        verbose_name_plural = "Configuración de agenda"

    def __str__(self):
        return "Configuración de agenda"

    def save(self, *args, **kwargs):
        self.pk = 1
        if type(self).objects.filter(pk=1).exists():
            kwargs.pop('force_insert', None)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Weekday(models.IntegerChoices):
    """Coincide con datetime.weekday(): lunes = 0."""
    MONDAY = 0, 'Lunes'
    TUESDAY = 1, 'Martes'
    WEDNESDAY = 2, 'Miércoles'
    THURSDAY = 3, 'Jueves'
    FRIDAY = 4, 'Viernes'
    SATURDAY = 5, 'Sábado'
    SUNDAY = 6, 'Domingo'


class WeeklySchedule(models.Model):
    """
    Horario de un día de la semana.

    Sin esto la agenda ofrecía slots los siete días con el mismo horario, así
    que un salón cerrado los domingos igual mostraba turnos disponibles.
    """

    weekday = models.IntegerField(choices=Weekday.choices, unique=True)
    is_open = models.BooleanField(default=True, verbose_name="Abierto")
    opens_at = models.TimeField(default=time(9, 0))
    closes_at = models.TimeField(default=time(19, 0))

    class Meta:
        verbose_name = "Horario semanal"
        verbose_name_plural = "Horario semanal"
        ordering = ('weekday',)

    def __str__(self):
        if not self.is_open:
            return f"{self.get_weekday_display()}: cerrado"
        return f"{self.get_weekday_display()}: {self.opens_at:%H:%M}–{self.closes_at:%H:%M}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.is_open and self.opens_at >= self.closes_at:
            raise ValidationError(
                {'closes_at': "La hora de cierre debe ser posterior a la de apertura."}
            )


class TimeBlock(models.Model):
    """
    Bloqueo manual de agenda: vacaciones, feriados, ausencias puntuales.

    Se resta de la disponibilidad igual que una cita, pero no pertenece a
    ninguna clienta.
    """

    class Reason(models.TextChoices):
        VACATION = 'vacation', 'Vacaciones'
        HOLIDAY = 'holiday', 'Feriado'
        PERSONAL = 'personal', 'Asunto personal'
        MAINTENANCE = 'maintenance', 'Mantenimiento'
        OTHER = 'other', 'Otro'

    start = models.DateTimeField()
    end = models.DateTimeField()
    reason = models.CharField(max_length=20, choices=Reason.choices, default=Reason.OTHER)
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Bloqueo de agenda"
        verbose_name_plural = "Bloqueos de agenda"
        ordering = ('-start',)
        indexes = [models.Index(fields=['start', 'end'])]

    def __str__(self):
        return f"{self.get_reason_display()} · {self.start:%d/%m %H:%M} → {self.end:%d/%m %H:%M}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.start >= self.end:
            raise ValidationError({'end': "El fin debe ser posterior al inicio."})


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
        verbose_name = "Cita"
        verbose_name_plural = "Citas"

    def __str__(self):
        return f"{self.customer_name} — {self.start_time.strftime('%Y-%m-%d %H:%M')}"

    @property
    def products(self):
        return [item.product for item in self.items.all() if item.product]

    @property
    def service_names(self):
        return [item.description for item in self.items.all()]

    @property
    def total_price(self):
        from decimal import Decimal
        return sum(
            (i.product.price for i in self.items.all() if i.product), Decimal('0.00')
        )


class AppointmentItem(models.Model):
    """
    Servicio incluido en una cita.

    Una cita admite varios: la clienta puede reservar manicura y pedicura en la
    misma visita, y la duración del turno es la suma de ambos.
    """

    appointment = models.ForeignKey(
        Appointment, on_delete=models.CASCADE, related_name='items'
    )
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True
    )
    # Copia del nombre: si el servicio se renombra, la cita vieja sigue
    # diciendo qué se reservó.
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Servicio de la cita"
        verbose_name_plural = "Servicios de la cita"

    def __str__(self):
        return self.description or (self.product.name if self.product else 'Servicio')

    def save(self, *args, **kwargs):
        if not self.description and self.product:
            self.description = self.product.name
        super().save(*args, **kwargs)
