from rest_framework import serializers

from .models import Direction, ExpenseCategory, Transaction


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ('id', 'name', 'is_direct')


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_automatic = serializers.BooleanField(read_only=True)

    class Meta:
        model = Transaction
        fields = (
            'id', 'direction', 'amount', 'date', 'description',
            'category', 'category_name', 'method', 'attachment',
            'order', 'is_automatic', 'created_at',
        )
        read_only_fields = ('order', 'created_at')

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "El monto debe ser positivo. Use 'direction' para indicar si "
                "es ingreso o gasto."
            )
        return value

    def validate(self, attrs):
        direction = attrs.get('direction', getattr(self.instance, 'direction', None))
        category = attrs.get('category', getattr(self.instance, 'category', None))
        if direction == Direction.IN and category is not None:
            raise serializers.ValidationError(
                {'category': "Las categorías son de gasto; un ingreso no lleva."}
            )
        return attrs
