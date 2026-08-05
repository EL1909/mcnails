from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FiscalRulesView, QuotationViewSet, ReceiptViewSet

router = DefaultRouter()
router.register('quotations', QuotationViewSet, basename='quotation')
router.register('receipts', ReceiptViewSet, basename='receipt')

urlpatterns = [
    path('fiscal/', FiscalRulesView.as_view(), name='billing-fiscal-rules'),
    path('', include(router.urls)),
]
