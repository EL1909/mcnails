from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Profile
from .serializers import RegisterSerializer, UserProfileSerializer, UserPublicSerializer, AdminUserUpdateSerializer


class LoginView(APIView):
    """
    Login con email o número de WhatsApp + contraseña.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = (request.data.get('identifier') or '').strip()
        password = request.data.get('password', '')

        if not identifier or not password:
            raise AuthenticationFailed('Credenciales requeridas.')

        user = None
        if '@' in identifier:
            try:
                user = User.objects.get(email=identifier)
            except User.DoesNotExist:
                pass
        else:
            try:
                user = User.objects.select_related('profile').get(profile__phone=identifier)
            except User.DoesNotExist:
                pass

        if user is None or not user.check_password(password):
            raise AuthenticationFailed('Credenciales incorrectas.')

        if not user.is_active:
            raise AuthenticationFailed('Cuenta inactiva.')

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })


class RegisterView(generics.CreateAPIView):
    """
    Registro público de nuevas clientas.
    """
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserPublicSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    Perfil del usuario autenticado.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    """
    Lista de clientes — solo admin.
    EsfuerzoVZ consume este endpoint para ver las clientas de MCnails.
    """
    queryset = User.objects.all().select_related('profile').order_by('-date_joined')
    serializer_class = UserPublicSerializer
    permission_classes = [permissions.IsAdminUser]


class AdminUserUpdateView(generics.UpdateAPIView):
    """
    Permite al admin editar nombre, email, teléfono y notas de cualquier cliente.
    """
    queryset = User.objects.all().select_related('profile')
    serializer_class = AdminUserUpdateSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['patch']


class AdminCreateUserView(APIView):
    """
    POST /api/accounts/users/create/
    Admin crea un cliente manualmente (sin contraseña — cuenta incompleta, no puede iniciar sesión).
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip() or None
        phone = (request.data.get('phone') or '').strip()
        notes = (request.data.get('notes') or '').strip()

        if not first_name and not email and not phone:
            return Response(
                {'error': 'Debes ingresar al menos nombre, email o teléfono.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if email and User.objects.filter(email=email).exists():
            return Response({'error': 'Ya existe un usuario con ese email.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()

        Profile.objects.create(user=user, phone=phone, notes=notes)

        return Response(UserPublicSerializer(user).data, status=status.HTTP_201_CREATED)
