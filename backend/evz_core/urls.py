from django.urls import path

from .views import BusinessIdentityView

urlpatterns = [
    path('', BusinessIdentityView.as_view(), name='business-identity'),
]
