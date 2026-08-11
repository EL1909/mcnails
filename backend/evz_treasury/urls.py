from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ExpenseCategoryViewSet,
    OrderPaymentsView,
    SummaryView,
    TransactionViewSet,
    YearlySummaryView,
)

router = DefaultRouter()
router.register('transactions', TransactionViewSet, basename='transaction')
router.register('categories', ExpenseCategoryViewSet, basename='expense-category')

urlpatterns = [
    path('summary/yearly/', YearlySummaryView.as_view(), name='treasury-summary-yearly'),
    path('summary/', SummaryView.as_view(), name='treasury-summary'),
    path('orders/<int:pk>/payments/', OrderPaymentsView.as_view(), name='order-payments'),
    path('', include(router.urls)),
]
