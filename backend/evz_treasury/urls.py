from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ExpenseCategoryViewSet,
    MarginsView,
    OrderPaymentsView,
    ReconciliationView,
    SummaryView,
    TransactionViewSet,
)

router = DefaultRouter()
router.register('transactions', TransactionViewSet, basename='transaction')
router.register('categories', ExpenseCategoryViewSet, basename='expense-category')

urlpatterns = [
    path('summary/', SummaryView.as_view(), name='treasury-summary'),
    path('reconciliation/', ReconciliationView.as_view(), name='treasury-reconciliation'),
    path('margins/', MarginsView.as_view(), name='treasury-margins'),
    path('orders/<int:pk>/payments/', OrderPaymentsView.as_view(), name='order-payments'),
    path('', include(router.urls)),
]
