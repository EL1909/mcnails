from rest_framework import status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BusinessProfile, TeamMember
from .serializers import (
    BusinessIdentitySerializer,
    TeamMemberAdminSerializer,
    TeamMemberCreateSerializer,
    TeamMemberPublicSerializer,
)


class IsSuperUser(BasePermission):
    """Gestionar el roster del equipo es cosa de la dueña, no de cualquier staff."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


class BusinessIdentityView(APIView):
    """
    GET /api/business/ — identidad pública de la empresa.

    Permite que el frontend tome nombre, logo y datos de contacto del backend
    en vez de tenerlos escritos a mano, que es lo que hace que el mismo
    frontend sirva para otra empresa cambiando un registro.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        profile = BusinessProfile.load()
        return Response(
            BusinessIdentitySerializer(profile, context={'request': request}).data
        )


class TeamMemberListView(APIView):
    """
    GET /api/business/team/ — equipo activo, para elegir con quién reservar.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        equipo = TeamMember.objects.filter(is_active=True)
        return Response(
            TeamMemberPublicSerializer(equipo, many=True, context={'request': request}).data
        )


class CurrentTeamMemberView(APIView):
    """
    GET /api/business/team/me/ — el TeamMember de quien está logueada, o 204
    si es una cuenta admin sin perfil de equipo (ej. superuser puro).

    Lo usa el panel para saber si quien entró debe ver/editar solo su propia
    agenda o la de todo el equipo.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        tm = TeamMember.objects.filter(user=request.user).first()
        if not tm:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(TeamMemberAdminSerializer(tm, context={'request': request}).data)


class TeamMemberViewSet(viewsets.ModelViewSet):
    """
    /api/business/team-members/ — gestión del roster. Solo la dueña
    (superuser) crea, edita o desactiva cuentas de equipo.
    """
    queryset = TeamMember.objects.select_related('user').order_by('display_name')
    permission_classes = [IsSuperUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'create':
            return TeamMemberCreateSerializer
        return TeamMemberAdminSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team_member = serializer.save()
        salida = TeamMemberAdminSerializer(team_member, context=self.get_serializer_context())
        return Response(salida.data, status=status.HTTP_201_CREATED)
