"""
Arma el reporte de un período a partir de los datos locales.

Solo produce AGREGADOS. Los nombres de las clientas, sus citas y sus compras
individuales nunca salen de este sistema: EsfuerzoVZ no los necesita para
evaluar la empresa y no hay razón para exponerlos.

Las apps opcionales se consultan solo si están instaladas, para que un cliente
que no use agenda o facturación pueda publicar igual.
"""

from decimal import Decimal

from django.apps import apps
from django.db.models import Count, Sum

from evz_core.models import BusinessProfile
from evz_store.models import Order, OrderItem
from evz_treasury import services as treasury
from evz_treasury.models import Direction, Transaction

from .models import SCHEMA_VERSION

ORDER_STATES = ('confirmed', 'completed')


def _dec(value):
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def _sales(start, end):
    """Órdenes efectivas del período, por fecha de reserva o de creación."""
    return Order.objects.filter(
        status__in=ORDER_STATES, created_at__date__gte=start, created_at__date__lte=end
    )


def _appointments(start, end):
    """Citas del período; 0 si el cliente no instaló la agenda."""
    if not apps.is_installed('evz_calendars'):
        return 0
    Appointment = apps.get_model('evz_calendars', 'Appointment')
    return Appointment.objects.filter(
        start_time__date__gte=start, start_time__date__lte=end,
        status__in=('pending', 'confirmed', 'completed'),
    ).count()


def _receipts(start, end):
    """Recibos emitidos; 0 si el cliente no instaló facturación."""
    if not apps.is_installed('evz_billing'):
        return 0
    Receipt = apps.get_model('evz_billing', 'Receipt')
    return Receipt.objects.filter(
        issue_date__gte=start, issue_date__lte=end, voided_at__isnull=True
    ).count()


def _declared_margin(start, end):
    """
    Margen declarado del período: Σ (precio − costo unitario) × cantidad.

    Sale de Product.unit_cost, que es una estimación de la dueña. Por eso se
    envía junto a la brecha de reconciliación, que revela si esa estimación
    está calibrada.
    """
    items = OrderItem.objects.filter(
        order__status__in=ORDER_STATES,
        order__created_at__date__gte=start,
        order__created_at__date__lte=end,
    ).select_related('product')

    total = Decimal('0.00')
    for it in items:
        costo = it.product.unit_cost if it.product else Decimal('0.00')
        total += (it.price_at_purchase - costo) * it.quantity
    return _dec(total)


def build_report(start, end):
    """Construye el payload que espera EsfuerzoVZ."""
    profile = BusinessProfile.load()
    resumen = treasury.period_summary(start, end)
    reconciliacion = treasury.reconciliation(start, end)

    ventas = _sales(start, end)
    n_ordenes = ventas.count()
    # Clientes distintos por correo; si no dejó correo, cuenta por nombre.
    clientes = ventas.exclude(customer_email='').values('customer_email').distinct().count()
    clientes += ventas.filter(customer_email='').values('customer_name').distinct().count()

    unidades = OrderItem.objects.filter(order__in=ventas).aggregate(
        n=Sum('quantity')
    )['n'] or 0

    ingresos = _dec(resumen['income'])
    ticket = _dec(ingresos / n_ordenes) if n_ordenes else Decimal('0.00')

    return {
        'schema_version': SCHEMA_VERSION,
        'currency': profile.currency,
        'period': {'start': start.isoformat(), 'end': end.isoformat()},
        'totals': {
            'income': str(ingresos),
            'expenses': str(_dec(resumen['expenses'])),
        },
        'metrics': {
            'customers_served': clientes,
            'appointments': _appointments(start, end),
            'units_sold': unidades,
            'orders': n_ordenes,
            'receipts_issued': _receipts(start, end),
            'avg_ticket': str(ticket),
            'declared_margin': str(_declared_margin(start, end)),
            'reconciliation_gap': str(_dec(reconciliacion['gap'])),
        },
    }


def preview(start, end):
    """Lo mismo que se enviaría, para revisarlo antes de publicar."""
    return build_report(start, end)
