from rest_framework import serializers
from .models import Category, Product, Order, OrderItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'duration', 'category', 'category_name', 'image', 'is_active']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price_at_purchase', 'subtotal']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    total = serializers.ReadOnlyField(source='total_amount')
    amount_paid = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    is_fully_paid = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'customer_name', 'customer_email', 'customer_phone',
            'status', 'booking_date', 'booking_time', 'payment_method',
            'created_at', 'items', 'total',
            'amount_paid', 'balance_due', 'is_fully_paid',
        ]

    def get_amount_paid(self, obj):
        from evz_treasury import services
        return str(services.amount_paid(obj))

    def get_balance_due(self, obj):
        from evz_treasury import services
        return str(services.balance_due(obj))

    def get_is_fully_paid(self, obj):
        from evz_treasury import services
        return services.is_fully_paid(obj)
