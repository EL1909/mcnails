from rest_framework import serializers

from .models import Quotation, QuotationItem, Receipt, ReceiptItem


class LineItemSerializer(serializers.Serializer):
    """Línea de entrada al crear un documento."""
    product = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.IntegerField(min_value=1, default=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False
    )


class QuotationItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = QuotationItem
        fields = ('id', 'product', 'description', 'quantity', 'unit_price',
                  'tax_rate', 'subtotal', 'total')


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    effective_status = serializers.CharField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    can_be_accepted = serializers.BooleanField(read_only=True)

    class Meta:
        model = Quotation
        fields = (
            'id', 'number', 'issue_date', 'valid_until', 'status',
            'effective_status', 'is_expired', 'can_be_accepted',
            'customer_name', 'customer_email', 'customer_phone', 'customer_tax_id',
            'notes', 'order', 'items', 'subtotal', 'tax_amount', 'total',
        )
        read_only_fields = ('number', 'order')


class ReceiptItemSerializer(serializers.ModelSerializer):
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ReceiptItem
        fields = ('id', 'description', 'quantity', 'unit_price', 'tax_rate',
                  'subtotal', 'total')


class ReceiptSerializer(serializers.ModelSerializer):
    items = ReceiptItemSerializer(many=True, read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_void = serializers.BooleanField(read_only=True)

    class Meta:
        model = Receipt
        fields = (
            'id', 'number', 'control_number', 'issue_date',
            'customer_name', 'customer_email', 'customer_phone', 'customer_tax_id',
            'issuer_legal_name', 'issuer_tax_id', 'issuer_address',
            'country_code', 'currency', 'order', 'notes',
            'items', 'subtotal', 'tax_amount', 'total',
            'is_void', 'voided_at', 'void_reason',
        )
        read_only_fields = fields


class CreateQuotationSerializer(serializers.Serializer):
    customer_name = serializers.CharField()
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    customer_phone = serializers.CharField(required=False, allow_blank=True)
    customer_tax_id = serializers.CharField(required=False, allow_blank=True)
    valid_days = serializers.IntegerField(default=30, min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = LineItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Se requiere al menos una línea.")
        return value


class IssueReceiptSerializer(serializers.Serializer):
    order = serializers.IntegerField(required=False, allow_null=True)
    control_number = serializers.CharField(required=False, allow_blank=True)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    customer_tax_id = serializers.CharField(required=False, allow_blank=True)
    items = LineItemSerializer(many=True, required=False)

    def validate(self, attrs):
        if not attrs.get('order') and not attrs.get('items'):
            raise serializers.ValidationError(
                "Indique una orden o las líneas a facturar."
            )
        return attrs
