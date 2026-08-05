import datetime
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models, transaction

from .fiscal import get_ruleset


class DocType(models.TextChoices):
    QUOTATION = 'quotation', 'Cotización'
    RECEIPT = 'receipt', 'Recibo'


class NumberingSeries(models.Model):
    """
    Contador de numeración secuencial.

    Los documentos fiscales exigen una secuencia sin huecos. Por eso el
    contador vive en base de datos y se incrementa con select_for_update:
    dos emisiones simultáneas no pueden tomar el mismo número.
    """

    doc_type = models.CharField(max_length=20, choices=DocType.choices)
    prefix = models.CharField(max_length=10, blank=True)
    year = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Solo para países con reinicio anual de numeración."
    )
    next_number = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "Serie de numeración"
        verbose_name_plural = "Series de numeración"
        unique_together = ('doc_type', 'year')

    def __str__(self):
        y = f" {self.year}" if self.year else ""
        return f"{self.get_doc_type_display()}{y} → próximo {self.next_number}"

    @classmethod
    @transaction.atomic
    def take_next(cls, doc_type, country_code):
        """
        Reserva y devuelve el siguiente número formateado.

        Debe llamarse dentro de la misma transacción que crea el documento:
        si el documento falla, el número se libera al hacer rollback y no
        queda un hueco en la secuencia.
        """
        ruleset = get_ruleset(country_code)
        year = datetime.date.today().year if ruleset.numbering_reset == 'yearly' else None

        series, _ = cls.objects.select_for_update().get_or_create(
            doc_type=doc_type, year=year,
            defaults={'prefix': 'COT-' if doc_type == DocType.QUOTATION else ''},
        )
        number = series.next_number
        series.next_number += 1
        series.save(update_fields=['next_number'])

        body = f"{number:06d}"
        if year:
            return f"{series.prefix}{year}-{body}"
        return f"{series.prefix}{body}"


class DocumentBase(models.Model):
    """Campos comunes a cotizaciones y recibos."""

    number = models.CharField(max_length=40, unique=True, editable=False)
    issue_date = models.DateField(default=datetime.date.today)

    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True)
    customer_phone = models.CharField(max_length=50, blank=True)
    customer_tax_id = models.CharField(max_length=50, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        ordering = ('-issue_date', '-created_at')

    # ── Totales, calculados desde las líneas ─────────────────────────────
    @property
    def subtotal(self):
        return sum((i.subtotal for i in self.items.all()), Decimal('0.00'))

    @property
    def tax_amount(self):
        return sum((i.tax_amount for i in self.items.all()), Decimal('0.00'))

    @property
    def total(self):
        return self.subtotal + self.tax_amount


class LineItemBase(models.Model):
    """
    Línea de documento.

    Guarda `description` y `unit_price` como copia, no como referencia al
    producto: si mañana sube el precio o se renombra el servicio, el documento
    ya emitido debe seguir diciendo lo que decía.
    """

    product = models.ForeignKey(
        'evz_store.Product', on_delete=models.SET_NULL, null=True, blank=True
    )
    description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.00'),
        help_text="Porcentaje. Se toma del país al crear la línea."
    )

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.quantity} × {self.description}"

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    @property
    def tax_amount(self):
        return (self.subtotal * self.tax_rate / Decimal('100')).quantize(Decimal('0.01'))

    @property
    def total(self):
        return self.subtotal + self.tax_amount


# ──────────────────────────────────────────────────────────────────────────
#  Cotizaciones
# ──────────────────────────────────────────────────────────────────────────

class QuotationStatus(models.TextChoices):
    DRAFT = 'draft', 'Borrador'
    SENT = 'sent', 'Enviada'
    ACCEPTED = 'accepted', 'Aceptada'
    REJECTED = 'rejected', 'Rechazada'
    EXPIRED = 'expired', 'Vencida'


class Quotation(DocumentBase):
    status = models.CharField(
        max_length=20, choices=QuotationStatus.choices, default=QuotationStatus.DRAFT
    )
    valid_until = models.DateField(
        null=True, blank=True, help_text="Fecha hasta la que se sostiene el precio."
    )
    # Se llena al aceptarse: la orden que nació de esta cotización.
    order = models.OneToOneField(
        'evz_store.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='quotation', editable=False
    )

    class Meta(DocumentBase.Meta):
        verbose_name = "Cotización"
        verbose_name_plural = "Cotizaciones"

    def __str__(self):
        return f"{self.number} · {self.customer_name}"

    @property
    def is_expired(self):
        if not self.valid_until:
            return False
        return datetime.date.today() > self.valid_until

    @property
    def effective_status(self):
        """Vencida se calcula, no se guarda: depende de la fecha de hoy."""
        if self.status == QuotationStatus.SENT and self.is_expired:
            return QuotationStatus.EXPIRED
        return self.status

    @property
    def can_be_accepted(self):
        return (
            self.status in (QuotationStatus.DRAFT, QuotationStatus.SENT)
            and not self.is_expired
        )


class QuotationItem(LineItemBase):
    quotation = models.ForeignKey(
        Quotation, on_delete=models.CASCADE, related_name='items'
    )


# ──────────────────────────────────────────────────────────────────────────
#  Recibos
# ──────────────────────────────────────────────────────────────────────────

class Receipt(DocumentBase):
    """
    Documento de venta emitido.

    Inmutable: una vez emitido no se edita ni se borra, solo se anula. Por eso
    copia los datos del emisor en el momento de emisión — si Marlyn cambia su
    dirección el año que viene, los recibos viejos deben conservar la vieja.
    """

    order = models.ForeignKey(
        'evz_store.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='receipts'
    )

    # Copia del emisor al momento de emitir
    issuer_legal_name = models.CharField(max_length=200)
    issuer_tax_id = models.CharField(max_length=50, blank=True)
    issuer_address = models.CharField(max_length=255, blank=True)
    country_code = models.CharField(max_length=2)
    currency = models.CharField(max_length=3)

    # Exigido por algunos países (Venezuela)
    control_number = models.CharField(max_length=40, blank=True)

    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.CharField(max_length=255, blank=True)

    class Meta(DocumentBase.Meta):
        verbose_name = "Recibo"
        verbose_name_plural = "Recibos"

    def __str__(self):
        estado = " (ANULADO)" if self.is_void else ""
        return f"{self.number} · {self.customer_name}{estado}"

    @property
    def is_void(self):
        return self.voided_at is not None

    @property
    def ruleset(self):
        return get_ruleset(self.country_code)

    def void(self, reason=''):
        """
        Anula el recibo. No lo borra: la secuencia numérica no puede tener
        huecos, así que el número sigue existiendo, marcado como anulado.
        """
        from django.utils import timezone
        if self.is_void:
            return self
        self.voided_at = timezone.now()
        self.void_reason = reason
        self.save(update_fields=['voided_at', 'void_reason'])
        return self

    def delete(self, *args, **kwargs):
        raise PermissionError(
            "Un recibo emitido no se borra: use void() para anularlo y "
            "conservar la secuencia numérica."
        )


class ReceiptItem(LineItemBase):
    receipt = models.ForeignKey(
        Receipt, on_delete=models.CASCADE, related_name='items'
    )
