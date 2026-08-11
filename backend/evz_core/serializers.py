from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import BusinessProfile, TeamMember


class TeamMemberPublicSerializer(serializers.ModelSerializer):
    """
    Perfil público de un miembro del equipo: lo que la clienta ve al elegir
    con quién reservar. Deliberadamente no expone `user` ni `is_active`.
    """

    class Meta:
        model = TeamMember
        fields = ('id', 'display_name', 'photo', 'bio')
        read_only_fields = fields


class TeamMemberAdminSerializer(serializers.ModelSerializer):
    """Perfil completo para la sección "Equipo" del panel — solo la dueña."""

    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = TeamMember
        fields = ('id', 'display_name', 'email', 'photo', 'bio', 'is_active')


class TeamMemberCreateSerializer(serializers.Serializer):
    """
    Crea la cuenta (User, is_staff) y el TeamMember en un solo paso: no tiene
    sentido un TeamMember sin login propio, así que no se exponen por
    separado.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    display_name = serializers.CharField(max_length=150)
    bio = serializers.CharField(required=False, allow_blank=True)
    photo = serializers.ImageField(required=False, allow_null=True)

    def validate_email(self, value):
        User = get_user_model()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con ese email.")
        return value

    def create(self, validated_data):
        User = get_user_model()
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            is_staff=True,
        )
        return TeamMember.objects.create(
            user=user,
            display_name=validated_data['display_name'],
            bio=validated_data.get('bio', ''),
            photo=validated_data.get('photo'),
        )


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
