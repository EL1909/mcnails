from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BusinessIdentityView,
    CurrentTeamMemberView,
    TeamMemberListView,
    TeamMemberViewSet,
)

router = DefaultRouter()
router.register('team-members', TeamMemberViewSet, basename='team-member-admin')

urlpatterns = [
    path('', BusinessIdentityView.as_view(), name='business-identity'),
    path('team/me/', CurrentTeamMemberView.as_view(), name='team-member-me'),
    path('team/', TeamMemberListView.as_view(), name='team-members'),
    path('', include(router.urls)),
]
