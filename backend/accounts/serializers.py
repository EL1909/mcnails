from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Profile


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['phone', 'profile_picture', 'notes']
        read_only_fields = ['notes']


class UserPublicSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()
    notes = serializers.SerializerMethodField()

    def get_phone(self, obj):
        try:
            return obj.profile.phone
        except Profile.DoesNotExist:
            return ''

    def get_notes(self, obj):
        try:
            return obj.profile.notes
        except Profile.DoesNotExist:
            return ''

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone', 'notes', 'is_verified', 'date_joined']


class UserProfileSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_verified', 'date_joined', 'profile']
        read_only_fields = ['id', 'email', 'is_staff', 'is_superuser', 'is_verified', 'date_joined']

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})

        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.save()

        profile, _ = Profile.objects.get_or_create(user=instance)
        for attr, value in profile_data.items():
            setattr(profile, attr, value)
        profile.save()

        return instance


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone', 'notes']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def update(self, instance, validated_data):
        phone = validated_data.pop('phone', None)
        notes = validated_data.pop('notes', None)

        email = validated_data.get('email', '')
        if email == '':
            validated_data['email'] = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        profile, _ = Profile.objects.get_or_create(user=instance)
        if phone is not None:
            profile.phone = phone
        if notes is not None:
            profile.notes = notes
        profile.save()

        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    phone = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'password', 'password2', 'phone']
        extra_kwargs = {
            'email': {'required': False, 'allow_blank': True, 'allow_null': True},
        }

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Las contraseñas no coinciden.'})
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip()
        if not email and not phone:
            raise serializers.ValidationError('Debes ingresar un email o número de WhatsApp.')
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        phone = (validated_data.pop('phone', '') or '').strip()
        email = (validated_data.get('email') or '').strip() or None
        validated_data['email'] = email
        user = User.objects.create_user(**validated_data)
        Profile.objects.create(user=user, phone=phone)
        return user
