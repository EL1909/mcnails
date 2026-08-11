from decimal import Decimal

from django.core.files.uploadedfile import UploadedFile
from django.db import models

from evz_core.models import TeamMember
from evz_core.utils import compress_if_image


def receipt_attachment_path(instance, filename):
    import time
    ext = filename.split('.')[-1]
    return f'treasury/{instance.date:%Y-%m}/comprobante_{int(time.time())}.{ext}'


class ExpenseCategory(models.Model):
    """Categoría de gasto. Vocabulario propio de la empresa."""

    name = models.CharField(max_length=100, unique=True)
    is_direct = models.BooleanField(
        default=True,
        help_text="Atribuible a un servicio concreto (materiales) frente a "
                  "gastos generales (alquiler, luz)."
    )

    class Meta:
        verbose_name = "Categoría de gasto"
        verbose_name_plural = "Categorías de gasto"
        ordering = ('name',)

    def __str__(self):
        return self.name


class Direction(models.TextChoices):
    IN = 'IN', 'Ingreso'
    OUT = 'OUT', 'Gasto'


class Method(models.TextChoices):
    CASH = 'cash', 'Efectivo'
    TRANSFER = 'transfer', 'Transferencia'
    CARD = 'card', 'Tarjeta'
    OTHER = 'other', 'Otro'


class TransactionQuerySet(models.QuerySet):
    def income(self):
        return self.filter(direction=Direction.IN)

    def expenses(self):
        return self.filter(direction=Direction.OUT)

    def in_period(self, start, end):
        return self.filter(date__gte=start, date__lte=end)

    def total(self):
        return self.aggregate(t=models.Sum('amount'))['t'] or Decimal('0.00')


class Transaction(models.Model):
    """
    Movimiento de dinero real de la empresa.

    Los ingresos se generan al confirmar una Order (ver services.py); los
    gastos los carga la dueña a mano.
    """

    direction = models.CharField(max_length=3, choices=Direction.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    description = models.CharField(max_length=255, blank=True)

    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.PROTECT, null=True, blank=True,
        related_name='transactions',
        help_text="Solo para gastos."
    )
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    attachment = models.FileField(upload_to=receipt_attachment_path, null=True, blank=True)

    # Si el ingreso vino de una venta, queda trazado hasta la orden.
    # Es FK y no OneToOne porque una orden admite abonos: la clienta deja un
    # anticipo al reservar y paga el resto al terminar.
    order = models.ForeignKey(
        'evz_store.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments'
    )

    # Solo para filtrar reportes por persona. Un ingreso lo hereda de su
    # Order; un gasto manual (sin order) queda opcional — no todo gasto es
    # atribuible a alguien del equipo (ej. alquiler).
    team_member = models.ForeignKey(
        TeamMember, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    objects = TransactionQuerySet.as_manager()

    class Meta:
        verbose_name = "Movimiento"
        verbose_name_plural = "Movimientos"
        ordering = ('-date', '-created_at')
        indexes = [models.Index(fields=['direction', 'date'])]

    def __str__(self):
        signo = '+' if self.direction == Direction.IN else '−'
        return f"{signo}{self.amount} · {self.description or self.get_direction_display()}"

    def save(self, *args, **kwargs):
        # El comprobante admite PDF además de fotos (factura escaneada), por
        # eso es FileField y no ImageField: compress_if_image deja pasar el
        # PDF intacto y solo reduce cuando de verdad es una imagen.
        if self.attachment and isinstance(self.attachment.file, UploadedFile):
            self.attachment = compress_if_image(self.attachment, quality=80)
        super().save(*args, **kwargs)

    @property
    def is_automatic(self):
        """Generado por una venta, no cargado a mano."""
        return self.order_id is not None
