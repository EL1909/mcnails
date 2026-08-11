from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import F
from .models import Category, Product, Order, OrderItem
from .serializers import CategorySerializer, ProductSerializer, OrderSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    """
    Categorías de servicios.
    Lectura pública — escritura solo admin.
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAdminUser()]


class ProductViewSet(viewsets.ModelViewSet):
    """
    Servicios/Productos del salon.
    Lectura pública — escritura solo admin.
    """
    serializer_class = ProductSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Product.objects.all()
        # Público solo ve productos activos
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAdminUser()]


class OrderViewSet(viewsets.ModelViewSet):
    """
    Órdenes / Reservas.
    Clientes pueden crear (POST) sin login.
    Gestión completa solo admin.
    """
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAdminUser()]

    def create(self, request, *args, **kwargs):
        items_data = request.data.get('items', [])
        if not items_data:
            return Response({'error': 'No items in order'}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.create(
            customer_name=request.data.get('customer_name', ''),
            customer_email=request.data.get('customer_email', ''),
            customer_phone=request.data.get('customer_phone', ''),
            booking_date=request.data.get('booking_date'),
            booking_time=request.data.get('booking_time'),
            payment_method=request.data.get('payment_method', ''),
        )

        for item in items_data:
            product = Product.objects.get(id=item['product_id'])
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=item.get('quantity', 1),
                price_at_purchase=product.price,
            )

        serializer = self.get_serializer(order)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        order.status = 'confirmed'
        order.payment_method = request.data.get('payment_method', 'MANUAL')
        order.save()
        return Response({'status': 'confirmed'})

    @action(detail=False, methods=['get'])
    def customers(self, request):
        """Devuelve clientes únicos de órdenes con estadísticas agregadas."""
        from django.db.models import Count, Sum, Min, Max, DecimalField
        from django.db.models.functions import Coalesce
        from decimal import Decimal

        customers_data = {}

        # Recorrer todas las órdenes y agrupar por email o nombre
        for order in self.queryset.prefetch_related('items'):
            key = order.customer_email if order.customer_email else order.customer_name

            # Calcular total de la orden
            order_total = sum(item.subtotal for item in order.items.all())

            if key not in customers_data:
                customers_data[key] = {
                    'email': order.customer_email,
                    'name': order.customer_name,
                    'order_count': 0,
                    'total_spent': Decimal('0.00'),
                    'first_order_date': order.created_at.date(),
                    'last_order_date': order.created_at.date(),
                }

            customer = customers_data[key]
            customer['order_count'] += 1
            customer['total_spent'] += Decimal(str(order_total))
            customer['first_order_date'] = min(customer['first_order_date'], order.created_at.date())
            customer['last_order_date'] = max(customer['last_order_date'], order.created_at.date())

        # Convertir a lista y formatear
        result = []
        for customer in customers_data.values():
            result.append({
                'email': customer['email'],
                'name': customer['name'] or 'Sin nombre',
                'order_count': customer['order_count'],
                'total_spent': str(customer['total_spent'].quantize(Decimal('0.01'))),
                'first_order_date': customer['first_order_date'].isoformat(),
                'last_order_date': customer['last_order_date'].isoformat(),
            })

        return Response(result)
