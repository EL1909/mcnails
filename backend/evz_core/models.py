from django.core.files.uploadedfile import UploadedFile
from django.db import models

from .utils import compress_image


def business_logo_path(instance, filename):
    import time
    ext = filename.split('.')[-1]
    return f'business/logo_{int(time.time())}.{ext}'


class SingletonQuerySet(models.QuerySet):
    def delete(self):
        # QuerySet.delete() no pasa por Model.delete(), así que sin esto un
        # BusinessProfile.objects.all().delete() borraría los datos legales.
        return 0, {}


class Currency(models.TextChoices):
    EUR = 'EUR', 'Euro'
    USD = 'USD', 'Dólar'
    VES = 'VES', 'Bolívar'


class Country(models.TextChoices):
    """
    País de facturación. Define qué reglas fiscales aplican.

    Solo el código vive aquí; las reglas (impuestos, numeración, campos
    obligatorios) están en evz_billing.fiscal, que es opcional. evz_core es
    app base y no puede depender de una app opcional.
    """
    VE = 'VE', 'Venezuela'
    DE = 'DE', 'Alemania'
    ES = 'ES', 'España'
    XX = 'XX', 'Otro / genérico'


class BusinessProfile(models.Model):
    """
    Identidad de la empresa dueña de este deploy.

    Singleton: un deploy sirve a una sola empresa, así que esta tabla tiene
    siempre exactamente una fila (pk=1). Ver save() y load().

    Guarda datos de negocio, no secretos. El token de EsfuerzoVZ y demás
    credenciales viven en .env (settings.EVZ_API_TOKEN).
    """

    # ── Identidad legal (aparece en recibos y cotizaciones) ──────────────
    legal_name = models.CharField(
        max_length=200, blank=True,
        help_text="Razón social completa, como aparece en documentos legales"
    )
    trade_name = models.CharField(
        max_length=100, blank=True,
        help_text="Nombre comercial, el que ve el público"
    )
    tax_id = models.CharField(
        max_length=50, blank=True,
        help_text="Identificación fiscal (RIF, USt-IdNr, etc. según el país)"
    )
    logo = models.ImageField(upload_to=business_logo_path, null=True, blank=True)

    # ── Contacto ─────────────────────────────────────────────────────────
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    country_code = models.CharField(
        max_length=2, choices=Country.choices, default=Country.XX,
        help_text="Define las reglas fiscales: impuesto, numeración y campos "
                  "obligatorios de los documentos."
    )
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)

    currency = models.CharField(
        max_length=3, choices=Currency.choices, default=Currency.EUR,
        help_text="Moneda de precios y documentos"
    )

    # ── Integración con EsfuerzoVZ ───────────────────────────────────────
    evz_project_slug = models.SlugField(
        max_length=100, blank=True,
        help_text="Slug del Project en EsfuerzoVZ al que pertenece esta empresa"
    )
    evz_sync_enabled = models.BooleanField(
        default=False,
        help_text="Enviar resúmenes financieros a EsfuerzoVZ"
    )

    updated_at = models.DateTimeField(auto_now=True)

    objects = SingletonQuerySet.as_manager()

    class Meta:
        verbose_name = "Datos de la Empresa"
        verbose_name_plural = "Datos de la Empresa"

    def __str__(self):
        return self.trade_name or self.legal_name or "Empresa sin configurar"

    def save(self, *args, **kwargs):
        # Fuerza el singleton: cualquier save escribe sobre la misma fila.
        # Si la fila ya existe hay que descartar force_insert (lo pone
        # objects.create()), o el INSERT choca contra la PK duplicada.
        self.pk = 1
        if type(self).objects.filter(pk=1).exists():
            kwargs.pop('force_insert', None)
        if self.logo and isinstance(self.logo.file, UploadedFile):
            if self.logo.name.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.bmp')):
                self.logo = compress_image(self.logo, max_size=(600, 600), quality=90)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # El singleton no se borra; vaciar los campos es lo correcto.
        pass

    @classmethod
    def load(cls):
        """Devuelve la única instancia, creándola con defaults si hace falta."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
