from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BusinessProfile
from .serializers import BusinessIdentitySerializer


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
