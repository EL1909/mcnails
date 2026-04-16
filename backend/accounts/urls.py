from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, RegisterView, ProfileView, UserListView,
    AdminUserUpdateView, AdminCreateUserView,
    PasswordResetRequestView, PasswordResetConfirmView, PasswordResetRedirectView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/create/', AdminCreateUserView.as_view(), name='admin-user-create'),
    path('users/<uuid:pk>/', AdminUserUpdateView.as_view(), name='admin-user-update'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('password-reset/<uidb64>/<token>/', PasswordResetRedirectView.as_view(), name='password-reset-redirect'),
]
