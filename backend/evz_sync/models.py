from django.db import models

SCHEMA_VERSION = 1


class SyncLog(models.Model):
    """
    Registro local de cada publicación hacia EsfuerzoVZ.

    Queda de este lado para que la dueña vea qué envió y cuándo sin depender
    de entrar a EsfuerzoVZ, y para poder diagnosticar un envío fallido.
    """

    class Status(models.TextChoices):
        OK = 'ok', 'Enviado'
        FAILED = 'failed', 'Falló'

    period_start = models.DateField()
    period_end = models.DateField()

    status = models.CharField(max_length=10, choices=Status.choices)
    http_status = models.PositiveIntegerField(null=True, blank=True)
    error = models.TextField(blank=True)

    payload = models.JSONField(default=dict, help_text="Lo que se envió")
    response = models.JSONField(default=dict, blank=True)

    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Publicación a EsfuerzoVZ"
        verbose_name_plural = "Publicaciones a EsfuerzoVZ"
        ordering = ('-sent_at',)

    def __str__(self):
        return f"{self.period_start} → {self.period_end} · {self.get_status_display()}"

    @property
    def succeeded(self):
        return self.status == self.Status.OK
