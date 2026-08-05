from rest_framework import serializers

from .models import BusinessProfile


class BusinessIdentitySerializer(serializers.ModelSerializer):
    """
    Identidad pública de la empresa: lo que el frontend necesita para
    presentarse (nombre, logo, contacto). Deliberadamente NO expone
    evz_project_slug ni evz_sync_enabled, que son configuración interna.
    """

    class Meta:
        model = BusinessProfile
        fields = (
            'legal_name', 'trade_name', 'tax_id', 'logo',
            'address', 'city', 'country', 'email', 'phone',
            'currency',
        )
        read_only_fields = fields
