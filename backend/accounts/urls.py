from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import LoginView, RegisterView, ProfileView, UserListView, AdminUserUpdateView, AdminCreateUserView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<uuid:pk>/', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('users/create/', AdminCreateUserView.as_view(), name='admin-user-create'),
]
