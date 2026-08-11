from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AppointmentBillingListView,
    AppointmentDetailView,
    AppointmentListCreateView,
    AvailabilityView,
    CalendarSettingsView,
    TimeBlockViewSet,
    WeeklyScheduleViewSet,
)

router = DefaultRouter()
router.register('schedule', WeeklyScheduleViewSet, basename='weekly-schedule')
router.register('blocks', TimeBlockViewSet, basename='time-block')

urlpatterns = [
    path('availability/', AvailabilityView.as_view(), name='availability'),
    path('appointments/billing/', AppointmentBillingListView.as_view(), name='appointments-billing'),
    path('appointments/', AppointmentListCreateView.as_view(), name='appointments'),
    path('appointments/<int:pk>/', AppointmentDetailView.as_view(), name='appointment-detail'),
    path('settings/', CalendarSettingsView.as_view(), name='calendar-settings'),
    path('', include(router.urls)),
]
