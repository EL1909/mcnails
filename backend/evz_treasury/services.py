"""
Lógica de negocio de tesorería.

Los ingresos siguen a los PAGOS, no a la confirmación de la orden. Con abonos
en el alcance, registrar el total al confirmar sobrestimaría los ingresos: la
clienta que deja €10 de anticipo no pagó €50.
"""

import datetime
from decimal import Decimal

from django.db.models import Sum
from django.db.models.functions import TruncMonth

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


def yearly_summary(year):
    """
    Ingresos y gastos mes a mes de un año completo, para el reporte anual.

    Una sola consulta agrupada por mes en vez de doce llamadas a
    period_summary — evita 12 round-trips por cada carga del reporte.
    """
    por_mes = {
        row['month'].month: row
        for row in (
            Transaction.objects
            .filter(date__year=year, direction=Direction.IN)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
        )
    }
    gastos_por_mes = {
        row['month'].month: row
        for row in (
            Transaction.objects
            .filter(date__year=year, direction=Direction.OUT)
            .annotate(month=TruncMonth('date'))
            .values('month')
            .annotate(total=Sum('amount'))
        )
    }

    meses = []
    total_income = Decimal('0.00')
    total_expenses = Decimal('0.00')
    for m in range(1, 13):
        income = por_mes.get(m, {}).get('total') or Decimal('0.00')
        expenses = gastos_por_mes.get(m, {}).get('total') or Decimal('0.00')
        total_income += income
        total_expenses += expenses
        meses.append({
            'month': m,
            'income': income,
            'expenses': expenses,
            'balance': income - expenses,
        })

    return {
        'year': year,
        'months': meses,
        'total_income': total_income,
        'total_expenses': total_expenses,
        'total_balance': total_income - total_expenses,
    }


