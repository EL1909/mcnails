import datetime
import json

from django import forms
from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html

from . import client, services
from .collector import preview
from .models import SyncLog


class PublishForm(forms.Form):
    period_start = forms.DateField(
        label="Desde", widget=forms.DateInput(attrs={'type': 'date'})
    )
    period_end = forms.DateField(
        label="Hasta", widget=forms.DateInput(attrs={'type': 'date'})
    )

    def clean(self):
        datos = super().clean()
        inicio, fin = datos.get('period_start'), datos.get('period_end')
        if inicio and fin and inicio > fin:
            raise forms.ValidationError("El inicio no puede ser posterior al fin.")
        if fin and fin > datetime.date.today():
            raise forms.ValidationError(
                "El período incluye fechas futuras: espere a que cierre."
            )
        return datos


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ('period_start', 'period_end', 'estado', 'sent_at', 'resumen')
    list_filter = ('status',)
    date_hierarchy = 'sent_at'

    # Es un registro de lo ocurrido: se consulta, no se edita.
    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Estado')
    def estado(self, obj):
        if obj.succeeded:
            return format_html('<b style="color:{}">{}</b>', '#137333', 'Enviado')
        return format_html(
            '<b style="color:#c5221f" title="{}">Falló</b>', obj.error[:200]
        )

    @admin.display(description='Enviado')
    def resumen(self, obj):
        t = (obj.payload or {}).get('totals') or {}
        if not t:
            return '—'
        return f"ingresos {t.get('income')} · costos {t.get('expenses')}"

    # ── Botón de publicar ────────────────────────────────────────────────
    def get_urls(self):
        return [
            path('publicar/', self.admin_site.admin_view(self.vista_publicar),
                 name='evz_sync_synclog_publish'),
        ] + super().get_urls()

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        extra_context['publish_url'] = reverse('admin:evz_sync_synclog_publish')
        return super().changelist_view(request, extra_context)

    def vista_publicar(self, request):
        inicio_def, fin_def = services.previous_month()
        estado = services.remote_status()

        if request.method == 'POST' and 'confirmar' in request.POST:
            form = PublishForm(request.POST)
            if form.is_valid():
                inicio = form.cleaned_data['period_start']
                fin = form.cleaned_data['period_end']
                try:
                    log = services.publish_period(inicio, fin)
                except client.SyncNotConfigured as e:
                    self.message_user(request, str(e), messages.ERROR)
                except client.SyncFailed as e:
                    self.message_user(
                        request, f"EsfuerzoVZ rechazó el envío: {e}", messages.ERROR
                    )
                else:
                    r = log.response or {}
                    self.message_user(
                        request,
                        f"Publicado ({r.get('status', 'ok')}): "
                        f"ingresos {r.get('income')} · costos {r.get('expenses')}."
                        + (" Se atendió una solicitud pendiente."
                           if r.get('fulfilled_request') else ''),
                        messages.SUCCESS,
                    )
                    return redirect('admin:evz_sync_synclog_changelist')
        else:
            form = PublishForm(
                request.POST or None,
                initial={'period_start': inicio_def, 'period_end': fin_def},
            )

        # Vista previa de lo que se enviaría, para que no sea a ciegas.
        datos_previos = None
        if form.is_bound and form.is_valid():
            datos_previos = preview(
                form.cleaned_data['period_start'], form.cleaned_data['period_end']
            )
        elif not form.is_bound:
            datos_previos = preview(inicio_def, fin_def)

        return render(request, 'evz_sync/publish.html', {
            **self.admin_site.each_context(request),
            'title': 'Publicar actividad en EsfuerzoVZ',
            'form': form,
            'preview': json.dumps(datos_previos, indent=2, ensure_ascii=False)
                       if datos_previos else None,
            'estado': estado,
            'opts': self.model._meta,
        })
