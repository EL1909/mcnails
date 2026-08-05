from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from evz_core.models import BusinessProfile
from evz_store.models import Product

from . import services
from .fiscal import get_ruleset
from .models import Quotation, Receipt
from .serializers import (
    CreateQuotationSerializer,
    IssueReceiptSerializer,
    QuotationSerializer,
    ReceiptSerializer,
)


def _resolve_lines(raw):
    """Convierte ids de producto en instancias."""
    ids = [l['product'] for l in raw if l.get('product')]
    productos = {p.id: p for p in Product.objects.filter(id__in=ids)}
    return [
        {**l, 'product': productos.get(l.get('product'))}
        for l in raw
    ]


class FiscalRulesView(APIView):
    """
    GET /api/billing/fiscal/ — reglas del país configurado.

    El frontend las usa para poner las etiquetas correctas (RIF vs USt-IdNr,
    Factura vs Rechnung) sin tener que conocer los países.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        profile = BusinessProfile.load()
        r = get_ruleset(profile.country_code)
        return Response({
            'country_code': r.code,
            'country_name': r.country_name,
            'tax_id_label': r.tax_id_label,
            'tax_label': r.tax_label,
            'default_tax_rate': r.default_tax_rate,
            'receipt_label': r.receipt_label,
            'quotation_label': r.quotation_label,
            'requires_control_number': r.requires_control_number,
            'numbering_reset': r.numbering_reset,
            'notes': r.notes,
        })


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.prefetch_related('items')
    serializer_class = QuotationSerializer
    permission_classes = [IsAdminUser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def create(self, request, *args, **kwargs):
        entrada = CreateQuotationSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        data = entrada.validated_data
        try:
            quotation = services.create_quotation(
                customer={
                    'name': data['customer_name'],
                    'email': data.get('customer_email', ''),
                    'phone': data.get('customer_phone', ''),
                    'tax_id': data.get('customer_tax_id', ''),
                },
                lines=_resolve_lines(data['items']),
                valid_days=data.get('valid_days', 30),
                notes=data.get('notes', ''),
            )
        except services.BillingError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            QuotationSerializer(quotation).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Acepta la cotización y genera la orden."""
        quotation = self.get_object()
        try:
            order = services.accept_quotation(quotation)
        except services.BillingError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'quotation': QuotationSerializer(quotation).data,
            'order_id': order.id,
        })


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    """Los recibos no se editan ni se borran: solo se emiten y se anulan."""
    queryset = Receipt.objects.prefetch_related('items')
    serializer_class = ReceiptSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['post'])
    def issue(self, request):
        entrada = IssueReceiptSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        data = entrada.validated_data

        order = None
        if data.get('order'):
            from evz_store.models import Order
            try:
                order = Order.objects.get(pk=data['order'])
            except Order.DoesNotExist:
                return Response({'error': 'Orden inexistente.'},
                                status=status.HTTP_404_NOT_FOUND)

        cliente = None
        if data.get('customer_name'):
            cliente = {
                'name': data['customer_name'],
                'email': data.get('customer_email', ''),
                'tax_id': data.get('customer_tax_id', ''),
            }

        try:
            receipt = services.issue_receipt(
                order=order,
                customer=cliente,
                lines=_resolve_lines(data['items']) if data.get('items') else None,
                control_number=data.get('control_number', ''),
            )
        except services.BillingError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        receipt = self.get_object()
        receipt.void(request.data.get('reason', ''))
        return Response(ReceiptSerializer(receipt).data)
