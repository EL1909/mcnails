"""
Lógica de negocio de tesorería.

Los ingresos siguen a los PAGOS, no a la confirmación de la orden. Con abonos
en el alcance, registrar el total al confirmar sobrestimaría los ingresos: la
clienta que deja €10 de anticipo no pagó €50.
"""

import datetime
from decimal import Decimal

from django.db.models import Sum

from evz_store.models import OrderItem, Product

from .models import Direction, Transaction


def amount_paid(order):
    """Cuánto se ha cobrado de esta orden, sumando abonos."""
    return (
        Transaction.objects.filter(order=order, direction=Direction.IN)
        .aggregate(t=Sum('amount'))['t'] or Decimal('0.00')
    )


def balance_due(order):
    """Cuánto falta por cobrar."""
    return order.total_amount - amount_paid(order)


def is_fully_paid(order):
    return balance_due(order) <= Decimal('0.00') and order.total_amount > 0


def record_payment(order, amount=None, method=None, date=None, description=None):
    """
    Registra un pago (total o abono) de una orden.

    Sin `amount` cobra el saldo pendiente completo, que es el caso común:
    la clienta paga todo al terminar el servicio.
    """
    pending = balance_due(order)
    amount = Decimal(amount) if amount is not None else pending

    if amount <= 0:
        raise ValueError("El monto del pago debe ser positivo.")
    if amount > pending:
        raise ValueError(
            f"El pago ({amount}) excede el saldo pendiente ({pending})."
        )

    return Transaction.objects.create(
        direction=Direction.IN,
        amount=amount,
        date=date or datetime.date.today(),
        description=description or f"Pago · {order.customer_name}",
        method=method or order.payment_method or 'cash',
        order=order,
    )


def period_summary(start, end):
    """Ingresos, gastos y balance de un rango de fechas."""
    qs = Transaction.objects.in_period(start, end)
    income = qs.income().total()
    expenses = qs.expenses().total()
    return {
        'start': start,
        'end': end,
        'income': income,
        'expenses': expenses,
        'balance': income - expenses,
    }


def reconciliation(start, end):
    """
    Compara el costo de material DECLARADO contra el gasto REAL del período.

    El margen que ve un inversionista sale de Product.unit_cost, que es una
    estimación de la dueña. Esto revela si esa estimación está calibrada:
    si el gasto real supera al declarado, los márgenes están inflados.
    """
    units = (
        OrderItem.objects
        .filter(
            order__status__in=('confirmed', 'completed'),
            order__created_at__date__gte=start,
            order__created_at__date__lte=end,
        )
        .values('product')
        .annotate(qty=Sum('quantity'))
    )

    costs = {p.id: p.unit_cost for p in Product.objects.all()}
    declared = sum(
        (costs.get(row['product'], Decimal('0.00')) * row['qty'] for row in units),
        Decimal('0.00'),
    )

    real = (
        Transaction.objects
        .in_period(start, end)
        .expenses()
        .filter(category__is_direct=True)
        .total()
    )

    gap = real - declared
    return {
        'declared_cost': declared,
        'real_direct_cost': real,
        'gap': gap,
        # Positivo = se gastó más de lo declarado → los márgenes están inflados.
        'declared_is_understated': gap > 0,
        'units_sold': sum(row['qty'] for row in units),
    }


def margins():
    """Margen por servicio, según el costo declarado."""
    return [
        {
            'product_id': p.id,
            'name': p.name,
            'price': p.price,
            'unit_cost': p.unit_cost,
            'margin': p.margin,
            'margin_pct': p.margin_pct,
        }
        for p in Product.objects.filter(is_active=True).order_by('name')
    ]
