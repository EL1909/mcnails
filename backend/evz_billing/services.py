"""
Emisión de documentos.

Todo lo que asigna un número corre dentro de una transacción: si la creación
del documento falla después de tomar el número, el rollback lo devuelve y la
secuencia no queda con huecos.
"""

import datetime
from decimal import Decimal

from django.db import transaction

from evz_core.models import BusinessProfile
from evz_store.models import Order, OrderItem

from .fiscal import get_ruleset
from .models import (
    DocType,
    NumberingSeries,
    Quotation,
    QuotationItem,
    QuotationStatus,
    Receipt,
    ReceiptItem,
)


class BillingError(Exception):
    """Error de negocio al emitir un documento."""


def _check_issuer_ready(profile, ruleset):
    """El país exige ciertos datos del emisor antes de poder emitir."""
    faltan = [
        campo for campo in ruleset.required_issuer_fields
        if not getattr(profile, campo, '')
    ]
    if faltan:
        etiquetas = {
            'legal_name': 'razón social',
            'tax_id': ruleset.tax_id_label,
            'address': 'dirección',
        }
        nombres = ', '.join(etiquetas.get(c, c) for c in faltan)
        raise BillingError(
            f"Faltan datos de la empresa para emitir en {ruleset.country_name}: "
            f"{nombres}. Complételos en Datos de la Empresa."
        )


# ──────────────────────────────────────────────────────────────────────────
#  Cotizaciones
# ──────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_quotation(customer, lines, valid_days=30, notes=''):
    """
    Crea una cotización.

    `lines`: [{'product': Product | None, 'description': str, 'quantity': int,
               'unit_price': Decimal}]
    """
    if not lines:
        raise BillingError("Una cotización necesita al menos una línea.")

    profile = BusinessProfile.load()
    ruleset = get_ruleset(profile.country_code)

    quotation = Quotation.objects.create(
        number=NumberingSeries.take_next(DocType.QUOTATION, profile.country_code),
        customer_name=customer.get('name', ''),
        customer_email=customer.get('email', ''),
        customer_phone=customer.get('phone', ''),
        customer_tax_id=customer.get('tax_id', ''),
        valid_until=datetime.date.today() + datetime.timedelta(days=valid_days),
        notes=notes,
    )
    _create_lines(QuotationItem, 'quotation', quotation, lines, ruleset)
    return quotation


@transaction.atomic
def accept_quotation(quotation):
    """Acepta una cotización y genera la orden correspondiente."""
    if not quotation.can_be_accepted:
        raise BillingError(
            f"La cotización {quotation.number} no se puede aceptar "
            f"(estado: {quotation.get_status_display()}"
            f"{', vencida' if quotation.is_expired else ''})."
        )

    order = Order.objects.create(
        customer_name=quotation.customer_name,
        customer_email=quotation.customer_email,
        customer_phone=quotation.customer_phone,
        status='confirmed',
    )
    for item in quotation.items.all():
        OrderItem.objects.create(
            order=order,
            product=item.product,
            quantity=item.quantity,
            price_at_purchase=item.unit_price,
        )

    quotation.status = QuotationStatus.ACCEPTED
    quotation.order = order
    quotation.save(update_fields=['status', 'order'])
    return order


# ──────────────────────────────────────────────────────────────────────────
#  Recibos
# ──────────────────────────────────────────────────────────────────────────

@transaction.atomic
def issue_receipt(order=None, customer=None, lines=None, control_number=''):
    """
    Emite un recibo, desde una orden o desde líneas sueltas.

    Copia los datos del emisor en ese momento: el documento debe conservar lo
    que decía aunque la empresa cambie de dirección después.
    """
    profile = BusinessProfile.load()
    ruleset = get_ruleset(profile.country_code)
    _check_issuer_ready(profile, ruleset)

    if order is not None:
        items = list(order.items.select_related('product'))
        if not items:
            raise BillingError("La orden no tiene líneas que facturar.")
        customer = customer or {
            'name': order.customer_name,
            'email': order.customer_email,
            'phone': order.customer_phone,
        }
        lines = [
            {
                'product': it.product,
                'description': it.product.name if it.product else 'Servicio',
                'quantity': it.quantity,
                'unit_price': it.price_at_purchase,
            }
            for it in items
        ]
    elif not lines:
        raise BillingError("Un recibo necesita una orden o líneas explícitas.")

    if ruleset.requires_control_number and not control_number:
        raise BillingError(
            f"{ruleset.country_name} exige número de control para emitir "
            f"una {ruleset.receipt_label.lower()}."
        )

    receipt = Receipt.objects.create(
        number=NumberingSeries.take_next(DocType.RECEIPT, profile.country_code),
        order=order,
        customer_name=(customer or {}).get('name', ''),
        customer_email=(customer or {}).get('email', ''),
        customer_phone=(customer or {}).get('phone', ''),
        customer_tax_id=(customer or {}).get('tax_id', ''),
        issuer_legal_name=profile.legal_name,
        issuer_tax_id=profile.tax_id,
        issuer_address=', '.join(filter(None, [profile.address, profile.city])),
        country_code=profile.country_code,
        currency=profile.currency,
        control_number=control_number,
    )
    _create_lines(ReceiptItem, 'receipt', receipt, lines, ruleset)
    return receipt


def _create_lines(model, fk_name, document, lines, ruleset):
    for line in lines:
        model.objects.create(
            **{fk_name: document},
            product=line.get('product'),
            description=line.get('description') or (
                line['product'].name if line.get('product') else 'Servicio'
            ),
            quantity=line.get('quantity', 1),
            unit_price=Decimal(str(line['unit_price'])),
            tax_rate=line.get('tax_rate', ruleset.default_tax_rate),
        )
