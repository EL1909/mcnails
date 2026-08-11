import datetime

from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import ExpenseCategory, Transaction
from .serializers import ExpenseCategorySerializer, TransactionSerializer


def _period(request):
    """Lee ?start=&end=; por defecto el mes en curso."""
    today = datetime.date.today()
    start = parse_date(request.query_params.get('start', '')) or today.replace(day=1)
    end = parse_date(request.query_params.get('end', '')) or today
    if start > end:
        return None, None, "El inicio del período es posterior al fin."
    return start, end, None


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAdminUser]


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Transaction.objects.select_related('category')
        direction = self.request.query_params.get('direction')
        if direction:
            qs = qs.filter(direction=direction.upper())
        start, end, err = _period(self.request)
        if err is None and self.request.query_params.get('start'):
            qs = qs.in_period(start, end)
        return qs

    def perform_destroy(self, instance):
        # Un ingreso de venta se borra cancelando la orden, no desde aquí:
        # si no, la orden queda confirmada sin su movimiento.
        if instance.is_automatic:
            raise ValidationError(
                "Este ingreso pertenece a una venta. Cancele la orden."
            )
        instance.delete()


class SummaryView(APIView):
    """GET /api/treasury/summary/?start=&end= — ingresos, gastos y balance."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        start, end, err = _period(request)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.period_summary(start, end))


class YearlySummaryView(APIView):
    """GET /api/treasury/summary/yearly/?year=YYYY — desglose mes a mes."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        year_str = request.query_params.get('year')
        try:
            year = int(year_str) if year_str else datetime.date.today().year
        except ValueError:
            return Response({'error': 'Año inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.yearly_summary(year))


class OrderPaymentsView(APIView):
    """
    GET  /api/treasury/orders/<id>/payments/ — abonos y saldo de una orden.
    POST                                     — registra un pago.

    Sin `amount` en el POST se cobra el saldo pendiente completo, que es el
    caso común; con `amount` se registra un abono parcial.
    """
    permission_classes = [IsAdminUser]

    def _order(self, pk):
        from evz_store.models import Order
        return Order.objects.filter(pk=pk).first()

    def get(self, request, pk):
        order = self._order(pk)
        if not order:
            return Response({'error': 'Orden inexistente.'},
                            status=status.HTTP_404_NOT_FOUND)
        pagos = Transaction.objects.filter(order=order).order_by('date')
        return Response({
            'order_id': order.id,
            'total': order.total_amount,
            'paid': services.amount_paid(order),
            'balance_due': services.balance_due(order),
            'is_fully_paid': services.is_fully_paid(order),
            'payments': TransactionSerializer(pagos, many=True).data,
        })

    def post(self, request, pk):
        order = self._order(pk)
        if not order:
            return Response({'error': 'Orden inexistente.'},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            pago = services.record_payment(
                order,
                amount=request.data.get('amount'),
                method=request.data.get('method'),
                date=parse_date(request.data.get('date', '')) or None,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'payment': TransactionSerializer(pago).data,
            'balance_due': services.balance_due(order),
            'is_fully_paid': services.is_fully_paid(order),
        }, status=status.HTTP_201_CREATED)
