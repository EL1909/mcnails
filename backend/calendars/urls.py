from django.urls import path
from .views import AvailabilityView, AppointmentListCreateView, AppointmentDetailView, CalendarSettingsView

urlpatterns = [
    path('availability/', AvailabilityView.as_view(), name='availability'),
    path('appointments/', AppointmentListCreateView.as_view(), name='appointments'),
    path('appointments/<int:pk>/', AppointmentDetailView.as_view(), name='appointment-detail'),
    path('settings/', CalendarSettingsView.as_view(), name='calendar-settings'),
]
