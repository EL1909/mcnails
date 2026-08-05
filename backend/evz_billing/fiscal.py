"""
Reglas fiscales por país.

Viven en código y no en base de datos porque son lógica (qué es obligatorio,
cómo se numera), no datos que el usuario edite. Lo que sí es dato editable es
el país de la empresa: BusinessProfile.country_code.

⚠️  LOS RULESETS SON UN PUNTO DE PARTIDA, NO ASESORÍA FISCAL.
    Antes de emitir documentos con valor legal, un contador del país debe
    validar tasas, campos obligatorios y reglas de numeración. Las normas
    cambian y varían según el régimen de cada contribuyente.
"""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class FiscalRuleset:
    code: str
    country_name: str

    # Cómo se llama el identificador fiscal en este país
    tax_id_label: str

    # Impuesto sobre ventas
    tax_label: str
    default_tax_rate: Decimal

    # Nombre del documento de venta
    receipt_label: str
    quotation_label: str

    # Numeración
    numbering_reset: str = 'never'      # 'never' | 'yearly'
    requires_control_number: bool = False

    # Campos que este país exige al emitir
    required_issuer_fields: tuple = field(default=('legal_name', 'tax_id'))
    required_customer_tax_id: bool = False

    notes: str = ''


VENEZUELA = FiscalRuleset(
    code='VE',
    country_name='Venezuela',
    tax_id_label='RIF',
    tax_label='IVA',
    default_tax_rate=Decimal('16.00'),
    receipt_label='Factura',
    quotation_label='Presupuesto',
    numbering_reset='never',
    requires_control_number=True,
    required_issuer_fields=('legal_name', 'tax_id', 'address'),
    required_customer_tax_id=False,
    notes=(
        'Pendiente de validar con contador: número de control, régimen del '
        'contribuyente y si aplica facturación por imprenta autorizada o '
        'máquina fiscal.'
    ),
)

ALEMANIA = FiscalRuleset(
    code='DE',
    country_name='Alemania',
    tax_id_label='USt-IdNr',
    tax_label='USt',
    default_tax_rate=Decimal('19.00'),
    receipt_label='Rechnung',
    quotation_label='Angebot',
    numbering_reset='yearly',
    requires_control_number=False,
    required_issuer_fields=('legal_name', 'tax_id', 'address'),
    notes='Kleinunternehmerregelung (§19 UStG) no contemplada todavía.',
)

ESPANA = FiscalRuleset(
    code='ES',
    country_name='España',
    tax_id_label='NIF',
    tax_label='IVA',
    default_tax_rate=Decimal('21.00'),
    receipt_label='Factura',
    quotation_label='Presupuesto',
    numbering_reset='yearly',
)

GENERICO = FiscalRuleset(
    code='XX',
    country_name='Genérico',
    tax_id_label='ID fiscal',
    tax_label='Impuesto',
    default_tax_rate=Decimal('0.00'),
    receipt_label='Recibo',
    quotation_label='Cotización',
)

RULESETS = {r.code: r for r in (VENEZUELA, ALEMANIA, ESPANA, GENERICO)}


def get_ruleset(country_code):
    """Reglas del país indicado; genérico si no está contemplado."""
    return RULESETS.get((country_code or '').upper(), GENERICO)


def ruleset_for_business():
    """Reglas del país configurado en BusinessProfile."""
    from evz_core.models import BusinessProfile
    return get_ruleset(BusinessProfile.load().country_code)
