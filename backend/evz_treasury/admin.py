from django.contrib import admin
from django.utils.html import format_html

from .models import Direction, ExpenseCategory, Transaction


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_direct', 'transaction_count')
    list_filter = ('is_direct',)

    @admin.display(description='Movimientos')
    def transaction_count(self, obj):
        return obj.transactions.count()


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'date', 'signed_amount', 'description', 'category', 'method', 'origin',
    )
    list_filter = ('direction', 'method', 'category', 'date')
    search_fields = ('description',)
    date_hierarchy = 'date'
    autocomplete_fields = ()

    fieldsets = (
        (None, {
            'fields': ('direction', 'amount', 'date', 'description'),
        }),
        ('Clasificación', {
            'fields': ('category', 'method', 'attachment'),
            'description': 'La categoría solo aplica a gastos.',
        }),
        ('Origen', {
            'fields': ('order',),
            'description': 'Se llena solo cuando el ingreso viene de una venta.',
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Monto', ordering='amount')
    def signed_amount(self, obj):
        color = '#137333' if obj.direction == Direction.IN else '#c5221f'
        signo = '+' if obj.direction == Direction.IN else '−'
        return format_html(
            '<b style="color:{}">{}{}</b>', color, signo, obj.amount
        )

    @admin.display(description='Origen')
    def origin(self, obj):
        return 'Venta' if obj.is_automatic else 'Manual'

    def get_readonly_fields(self, request, obj=None):
        # Un ingreso generado por una venta no se edita a mano: su monto lo
        # manda la orden, y tocarlo aquí descuadraría la contabilidad.
        if obj and obj.is_automatic:
            return ('direction', 'amount', 'order')
        return ()
