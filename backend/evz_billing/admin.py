from django.contrib import admin, messages
from django.utils.html import format_html

from .models import (
    NumberingSeries,
    Quotation,
    QuotationItem,
    Receipt,
    ReceiptItem,
)
from .services import BillingError, accept_quotation


@admin.register(NumberingSeries)
class NumberingSeriesAdmin(admin.ModelAdmin):
    list_display = ('doc_type', 'year', 'prefix', 'next_number')
    # El contador no se edita a mano: retroceder crearía números duplicados.
    readonly_fields = ('next_number',)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1
    fields = ('product', 'description', 'quantity', 'unit_price', 'tax_rate')


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ('number', 'customer_name', 'issue_date', 'valid_until',
                    'status_badge', 'total_display')
    list_filter = ('status', 'issue_date')
    search_fields = ('number', 'customer_name', 'customer_email')
    readonly_fields = ('number', 'order', 'created_at')
    inlines = [QuotationItemInline]
    actions = ['accion_aceptar']

    @admin.display(description='Estado')
    def status_badge(self, obj):
        colores = {
            'draft': '#5f6368', 'sent': '#1a73e8', 'accepted': '#137333',
            'rejected': '#c5221f', 'expired': '#b06000',
        }
        estado = obj.effective_status
        etiqueta = dict(obj._meta.get_field('status').choices).get(estado, estado)
        return format_html(
            '<b style="color:{}">{}</b>', colores.get(estado, '#000'), etiqueta
        )

    @admin.display(description='Total')
    def total_display(self, obj):
        return obj.total

    @admin.action(description='Aceptar y generar orden')
    def accion_aceptar(self, request, queryset):
        ok = 0
        for q in queryset:
            try:
                accept_quotation(q)
                ok += 1
            except BillingError as e:
                self.message_user(request, f"{q.number}: {e}", messages.WARNING)
        if ok:
            self.message_user(request, f"{ok} cotización(es) aceptada(s).", messages.SUCCESS)


class ReceiptItemInline(admin.TabularInline):
    model = ReceiptItem
    extra = 0
    can_delete = False
    fields = ('description', 'quantity', 'unit_price', 'tax_rate')
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ('number', 'customer_name', 'issue_date', 'total_display', 'estado')
    list_filter = ('issue_date', 'country_code')
    search_fields = ('number', 'customer_name', 'control_number')
    inlines = [ReceiptItemInline]
    actions = ['accion_anular']

    # Un recibo emitido es inmutable: se ve, no se edita.
    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        # Se emiten desde el flujo de venta, no tecleando en el admin.
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description='Total')
    def total_display(self, obj):
        return obj.total

    @admin.display(description='Estado')
    def estado(self, obj):
        if obj.is_void:
            return format_html('<b style="color:{}">{}</b>', '#c5221f', 'ANULADO')
        return format_html('<b style="color:{}">{}</b>', '#137333', 'Emitido')

    @admin.action(description='Anular recibo')
    def accion_anular(self, request, queryset):
        n = sum(1 for r in queryset if not r.is_void and r.void('Anulado desde el admin'))
        self.message_user(request, f"{n} recibo(s) anulado(s).", messages.SUCCESS)
